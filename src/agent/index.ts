/**
 * src/agent/index.ts
 * ─────────────────────────────────────────────────────────────
 * Agentic AI Orchestrator — interactive multi-story pipeline:
 *
 *   0.  Prompt presenter for 1-N Jira issue keys + plain-English test cases
 *   1.  Ensure GitHub repository exists
 *   2.  For EACH story — fetch Jira, generate Playwright tests via Claude, commit
 *   3.  Commit shared config + mock server
 *   4.  Trigger GitHub Actions CI/CD (one run covers all stories)
 *   5.  Poll until run completes
 *   6.  Download Playwright results.json artifact
 *   7.  Render interactive HTML dashboard → open in browser
 *   8.  Post per-story Jira comments with ADF test-results table
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { fetchIssue, postComment, transitionIssue } from '../jira/client';
import { getAllUsers }                              from '../db/client';
import { generatePlaywrightTests }                 from './testGenerator';
import { collectStories, printStorySummary }       from './prompt';
import { buildAndShowReport, buildJiraAdfBody }    from './report';
import {
  ensureBranch,
  commitFile,
  triggerWorkflow,
  waitForLatestRun,
  createRepoIfNeeded,
} from '../github/client';

const GITHUB_REPO = process.env.GITHUB_REPO!;

// ── Shared files committed once per run ──────────────────────────────────────
const PLAYWRIGHT_CONFIG = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/generated',
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  reporter: [['list'], ['json', { outputFile: 'playwright-report/results.json' }]],
});
`;

const MOCK_SERVER = `import express, { Request, Response } from 'express';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

interface User {
  id: number; name: string;
  export_status: 'US_PERSON' | 'NON_US_PERSON';
  username: string; password_hash: string;
}

const app     = express();
const PORT    = process.env.PORT ?? 3000;
const DB_PATH = path.join(__dirname, '..', process.env.DB_PATH ?? 'data/users.db');
const db      = new Database(DB_PATH, { readonly: true });

// Returns all users without passwords — tests call this at runtime
app.get('/api/users', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, name, export_status, username FROM users').all();
  return res.json({ users });
});

app.get('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.query as { username?: string; password?: string };
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Missing credentials.' });

  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
    .get(username, password) as User | undefined;

  if (!user)
    return res.status(200).json({ success: false, message: 'Invalid username or password.' });

  if (user.export_status === 'NON_US_PERSON')
    return res.status(200).json({
      success:      false,
      message:      'Only US Persons are allowed to watch this demo.',
      exportStatus: user.export_status,
    });

  return res.status(200).json({
    success:      true,
    message:      'Login successful. Welcome!',
    exportStatus: user.export_status,
  });
});

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

app.listen(Number(PORT), '0.0.0.0', () =>
  console.log(\`Mock server on http://0.0.0.0:\${PORT}\`)
);
`;

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n🤖  Agentic AI Framework — Interactive Multi-Story Pipeline\n');
  console.log('═'.repeat(56));

  // ── Step 0: Collect stories interactively ─────────────────
  const stories = await collectStories();
  printStorySummary(stories);

  // ── Step 1: Ensure GitHub repo ─────────────────────────────
  console.log('📦  Step 1 – Ensuring GitHub repository exists…');
  await createRepoIfNeeded(GITHUB_REPO, 'Agentic AI Playwright POC — auto-generated tests');

  // ── Step 2: Preview DB users (informational only — tests load live) ──────
  console.log('\n🗄️   Step 2 – Previewing SQLite users (tests will load these at runtime)…');
  const users = getAllUsers();
  console.log(`   ✓  ${users.length} users in DB:`);
  users.forEach((u) => console.log(`       • ${u.name} (${u.export_status}) → ${u.export_status === 'US_PERSON' ? 'login will PASS ✅' : 'login will FAIL ❌'}`));

  // ── Step 3: Prepare branch & commit shared files ───────────
  console.log(`\n🌿  Step 3 – Preparing GitHub branch…`);
  await ensureBranch();

  const timestamp = new Date().toISOString();
  const storyKeys = stories.map((s) => s.issueKey).join(', ');
  const commitMsg = `feat(agent): auto-generate tests for [${storyKeys}] @ ${timestamp}`;

  await commitFile('playwright.config.ts', PLAYWRIGHT_CONFIG, commitMsg);
  await commitFile('scripts/mockServer.ts',  MOCK_SERVER,       commitMsg);

  // ── Step 4: Per-story — fetch + generate + commit ──────────
  console.log('\n🧠  Step 4 – Generating tests for each story…');

  const issueMap: Record<string, Awaited<ReturnType<typeof fetchIssue>>> = {};

  for (const story of stories) {
    const { issueKey, plainEnglishTestCases } = story;
    console.log(`\n   ▶  ${issueKey}`);

    const issue = await fetchIssue(issueKey);
    issueMap[issueKey] = issue;
    console.log(`      ✓  "${issue.summary}" (${issue.status})`);

    if (plainEnglishTestCases.length) {
      console.log(`      📝  ${plainEnglishTestCases.length} plain-English test case(s) to implement:`);
      plainEnglishTestCases.forEach((tc) => console.log(`         – ${tc.description}`));
    } else {
      console.log('      📝  Deriving tests from Jira acceptance criteria…');
    }

    console.log('      🤖  Calling Claude to generate Playwright TypeScript…');
    const testCode = await generatePlaywrightTests(issue, plainEnglishTestCases);
    console.log(`      ✓  ${testCode.split('\n').length} lines generated`);

    await commitFile(`tests/generated/${issueKey}.spec.ts`, testCode, commitMsg);
  }

  // ── Step 5: Trigger CI ─────────────────────────────────────
  console.log('\n🚀  Step 5 – Triggering GitHub Actions workflow…');
  await triggerWorkflow('ci.yml', 'main');

  // ── Step 6: Wait for result ────────────────────────────────
  console.log('\n⏳  Step 6 – Waiting for workflow run to complete…');
  const run = await waitForLatestRun('ci.yml', 600_000, 'main');

  const icon       = run.conclusion === 'success' ? '✅' : '❌';
  const resultLine = `${icon} CI result: ${run.conclusion?.toUpperCase()} | Run #${run.runId} | ${run.url}`;
  console.log(`\n${resultLine}`);

  // ── Step 7: Download artifact + render HTML dashboard ──────
  const summary = await buildAndShowReport(run.runId, run.url, run.conclusion ?? 'unknown');

  // ── Step 8: Post per-story Jira comments ──────────────────
  console.log('\n💬  Step 8 – Posting results to all Jira stories…');
  const allKeys = stories.map((s) => s.issueKey);

  for (const story of stories) {
    const { issueKey } = story;
    const issue = issueMap[issueKey];

    if (summary) {
      // Rich comment with ADF test-results table
      const adfBody = buildJiraAdfBody(summary, issueKey, allKeys);
      await postComment(issueKey, '', adfBody);
    } else {
      // Fallback plain-text comment if artifact wasn't available
      const siblings  = allKeys.filter((k) => k !== issueKey);
      const testedWith = siblings.length ? `\nTested alongside: ${siblings.join(', ')}` : '';
      const comment = [
        `🤖 Agentic AI Pipeline Report — ${new Date().toUTCString()}`,
        `Story : ${issue.key} — ${issue.summary}`,
        `Branch: ${process.env.GITHUB_BRANCH}${testedWith}`,
        ``,
        resultLine,
        ``,
        `Tests generated by Claude (claude-sonnet-4-6).`,
      ].join('\n');
      await postComment(issueKey, comment);
    }

    if (run.conclusion === 'success') {
      await transitionIssue(issueKey, 'Done');
    }
  }

  console.log('\n' + '═'.repeat(56));
  console.log(`✅  Pipeline complete! Processed ${stories.length} story/stories.\n`);
  if (summary) {
    console.log(`📊  Dashboard: local-reports/report-${run.runId}.html\n`);
  }
}

main().catch((err) => {
  console.error('\n❌  Pipeline failed:', err);
  process.exit(1);
});
