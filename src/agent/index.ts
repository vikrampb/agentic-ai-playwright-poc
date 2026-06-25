/**
 * src/agent/index.ts
 * ─────────────────────────────────────────────────────────────
 * Agentic AI Orchestrator – end-to-end POC pipeline:
 *
 *   1.  Read Jira story (via Atlassian REST API)
 *   2.  Query embedded SQLite for test data
 *   3.  Call Claude to generate Playwright TypeScript tests
 *   4.  Commit tests + config to GitHub (agent branch)
 *   5.  Trigger GitHub Actions CI/CD workflow
 *   6.  Poll until run completes
 *   7.  Post results back to Jira (comment + status transition)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { fetchIssue, postComment, transitionIssue } from '../jira/client';
import { getAllUsers }                              from '../db/client';
import { generatePlaywrightTests }                 from './testGenerator';
import {
  ensureBranch,
  commitFile,
  triggerWorkflow,
  waitForLatestRun,
  createRepoIfNeeded,
} from '../github/client';

const JIRA_ISSUE_KEY  = process.env.JIRA_ISSUE_KEY!;
const GITHUB_REPO     = process.env.GITHUB_REPO!;

// ── Playwright config (committed alongside the tests) ─────────────────────────
const PLAYWRIGHT_CONFIG = `
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/generated',
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  reporter: [['list'], ['json', { outputFile: 'playwright-report/results.json' }]],
});
`.trimStart();

// ── Simple login API mock (committed to repo so CI can run it) ─────────────────
const MOCK_SERVER = `
/**
 * scripts/mockServer.ts
 * Lightweight Express server that simulates the login endpoint.
 * The GitHub Actions job starts this before running Playwright.
 */
import express from 'express';
import Database from 'better-sqlite3';
import * as path from 'path';

const app  = express();
const db   = new Database(path.join(__dirname, '../data/users.db'), { readonly: true });
const PORT = process.env.PORT ?? 3000;

app.get('/api/login', (req, res) => {
  const { username, password } = req.query as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing credentials.' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
    .get(username, password) as { export_status: string; name: string } | undefined;

  if (!user) {
    return res.json({ success: false, message: 'Invalid credentials.' });
  }

  if (user.export_status === 'NON_US_PERSON') {
    return res.json({
      success: false,
      message: 'Only US Persons are allowed to watch this demo.',
      exportStatus: user.export_status,
    });
  }

  return res.json({ success: true, message: 'Login successful.', exportStatus: user.export_status });
});

app.listen(PORT, () => console.log(\`Mock server running on http://localhost:\${PORT}\`));
`.trimStart();

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n🤖  Agentic AI Framework — starting pipeline\n');
  console.log('═'.repeat(56));

  // ── Step 1: GitHub repo ────────────────────────────────────
  console.log('\n📦  Step 1 – Ensuring GitHub repository exists…');
  await createRepoIfNeeded(GITHUB_REPO, 'Agentic AI Playwright POC — auto-generated tests');

  // ── Step 2: Read Jira story ────────────────────────────────
  console.log(`\n📋  Step 2 – Fetching Jira issue ${JIRA_ISSUE_KEY}…`);
  const issue = await fetchIssue(JIRA_ISSUE_KEY);
  console.log(`   ✓  "${issue.summary}" (${issue.status})`);

  // ── Step 3: Query SQLite ────────────────────────────────────
  console.log('\n🗄️   Step 3 – Reading test data from SQLite…');
  const users = getAllUsers();
  const testData = users.map((u) => ({
    username: u.username,
    password: u.password_hash,
    exportStatus: u.export_status,
    name: u.name,
  }));
  console.log(`   ✓  ${testData.length} users loaded`);
  testData.forEach((u) => console.log(`       • ${u.name} (${u.exportStatus})`));

  // ── Step 4: Generate tests via Claude ──────────────────────
  console.log('\n🧠  Step 4 – Asking Claude to generate Playwright tests…');
  const testCode = await generatePlaywrightTests(issue, testData);
  console.log(`   ✓  Generated ${testCode.split('\n').length} lines of test code`);

  // ── Step 5: Push to GitHub ─────────────────────────────────
  console.log(`\n📤  Step 5 – Pushing files to GitHub branch "${process.env.GITHUB_BRANCH}"…`);
  await ensureBranch();

  const timestamp = new Date().toISOString();
  const commitMsg = `feat(agent): auto-generate tests for ${JIRA_ISSUE_KEY} [${timestamp}]`;

  await commitFile(`tests/generated/${JIRA_ISSUE_KEY}.spec.ts`, testCode,           commitMsg);
  await commitFile('playwright.config.ts',                        PLAYWRIGHT_CONFIG,  commitMsg);
  await commitFile('scripts/mockServer.ts',                       MOCK_SERVER,        commitMsg);

  // ── Step 6: Trigger CI ─────────────────────────────────────
  console.log('\n🚀  Step 6 – Triggering GitHub Actions workflow…');
  await triggerWorkflow('ci.yml');

  // ── Step 7: Wait for result ────────────────────────────────
  console.log('\n⏳  Step 7 – Waiting for workflow run to complete…');
  const run = await waitForLatestRun('ci.yml');

  const icon       = run.conclusion === 'success' ? '✅' : '❌';
  const resultLine = `${icon} GitHub Actions result: ${run.conclusion?.toUpperCase()} | Run #${run.runId} | ${run.url}`;
  console.log(`\n${resultLine}`);

  // ── Step 8: Post back to Jira ──────────────────────────────
  console.log('\n💬  Step 8 – Posting results to Jira…');
  const comment = [
    `🤖 Agentic AI Pipeline Report — ${new Date().toUTCString()}`,
    ``,
    `Story: ${issue.key} — ${issue.summary}`,
    `Branch: ${process.env.GITHUB_BRANCH}`,
    ``,
    `${resultLine}`,
    ``,
    `Tests generated by Claude (claude-sonnet-4-6) based on the Jira acceptance criteria.`,
  ].join('\n');

  await postComment(JIRA_ISSUE_KEY, comment);

  if (run.conclusion === 'success') {
    await transitionIssue(JIRA_ISSUE_KEY, 'Done');
  }

  console.log('\n═'.repeat(56));
  console.log('✅  Pipeline complete!\n');
}

main().catch((err) => {
  console.error('\n❌  Pipeline failed:', err);
  process.exit(1);
});
