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
import { buildAndShowReport, buildJiraAdfBody, openInNewBrowserSession } from './report';
import { saveLoginUi }                               from './loginUi';
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

// Returns all users including password — POC only, never do this in production.
app.get('/api/users', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, name, export_status, username, password_hash as password FROM users').all();
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

  const issueMap: Record<string, Awaited<ReturnType<typeof fetchIssue>> | null> = {};
  const skippedKeys: string[] = [];

  for (const story of stories) {
    const { issueKey, plainEnglishTestCases } = story;
    console.log(`\n   ▶  ${issueKey}`);

    // ── Try to fetch the Jira issue — skip gracefully if invalid ──────────
    let issue: Awaited<ReturnType<typeof fetchIssue>> | null = null;
    try {
      issue = await fetchIssue(issueKey);
      issueMap[issueKey] = issue;
      console.log(`      ✓  "${issue.summary}" (${issue.status})`);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      const isNotFound = msg.includes('404') || msg.toLowerCase().includes('does not exist');
      if (isNotFound) {
        console.log(`      ⚠️   Jira key "${issueKey}" not found or inaccessible — generating skipped test`);
        skippedKeys.push(issueKey);
        issueMap[issueKey] = null;

        // Commit a skipped placeholder test so CI still passes
        const skippedTest = [
          `import { test } from '@playwright/test';`,
          ``,
          `// ⚠️  Jira issue "${issueKey}" was not found or you do not have permission to view it.`,
          `// This test has been automatically skipped by the Agentic AI Pipeline.`,
          ``,
          `test.describe('${issueKey} – SKIPPED (invalid Jira key)', () => {`,
          `  test.skip(true, 'Jira issue "${issueKey}" does not exist or is inaccessible. Please check the key and try again.');`,
          `  test('placeholder', async () => {});`,
          `});`,
        ].join('\n');

        await commitFile(`tests/generated/${issueKey}.spec.ts`, skippedTest, commitMsg);
        continue;
      }
      // Re-throw unexpected errors
      throw err;
    }

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

  if (skippedKeys.length > 0) {
    console.log(`\n   ⚠️   Skipped ${skippedKeys.length} invalid key(s): ${skippedKeys.join(', ')}`);
    console.log('      These will appear as skipped tests in the Playwright report.');
  }

  // ── Step 5: Clear stale results.json then trigger CI ────────
  console.log('\n🧹  Step 5a – Clearing stale results.json from agent branch…');
  try {
    const { Octokit } = require('octokit');
    const octokit = new (require('octokit').Octokit)({ auth: process.env.GITHUB_TOKEN });
    const existing = await octokit.rest.repos.getContent({
      owner: process.env.GITHUB_OWNER!,
      repo:  process.env.GITHUB_REPO!,
      path:  'playwright-report/results.json',
      ref:   process.env.GITHUB_BRANCH ?? 'agent/auto-tests',
    }).catch(() => null);
    if (existing) {
      await octokit.rest.repos.deleteFile({
        owner:   process.env.GITHUB_OWNER!,
        repo:    process.env.GITHUB_REPO!,
        path:    'playwright-report/results.json',
        message: 'chore: clear stale results before new CI run [skip ci]',
        sha:     (existing.data as any).sha,
        branch:  process.env.GITHUB_BRANCH ?? 'agent/auto-tests',
      });
      console.log('   ✓  Stale results.json deleted');
    } else {
      console.log('   ✓  No stale results.json found');
    }
  } catch (e) {
    console.log('   ⚠️   Could not clear results.json:', (e as Error).message);
  }

  console.log('\n🚀  Step 5b – Triggering GitHub Actions workflow…');
  await triggerWorkflow('ci.yml', 'main');

  // ── Step 6: Wait for result ────────────────────────────────
  console.log('\n⏳  Step 6 – Waiting for workflow run to complete…');
  const run = await waitForLatestRun('ci.yml', 600_000, 'main');

  const icon       = run.conclusion === 'success' ? '✅' : '❌';
  const resultLine = `${icon} CI result: ${run.conclusion?.toUpperCase()} | Run #${run.runId} | ${run.url}`;
  console.log(`\n${resultLine}`);

  // ── Step 7: Build reports + open both in a new browser session ─────────
  const reportResult = await buildAndShowReport(run.runId, run.url, run.conclusion ?? 'unknown');

  const uiSummary = reportResult?.summary ?? {
    runId:      run.runId,
    runUrl:     run.url,
    conclusion: run.conclusion ?? 'unknown',
    startedAt:  new Date().toUTCString(),
    totalTests: 0,
    passed:     0,
    failed:     0,
    skipped:    0,
    durationMs: 0,
    tests:      [],
  };

  const loginUiPath  = saveLoginUi(uiSummary, run.runId);
  const reportPath   = reportResult?.reportPath;

  console.log('\n🌐  Step 7b – Opening both views in a new browser session…');
  if (reportPath) {
    openInNewBrowserSession(reportPath, loginUiPath);
  } else {
    // No test dashboard available — open login UI only
    try {
      const { spawn } = require('child_process');
      const proc = spawn('open', [loginUiPath], { detached: true, stdio: 'ignore' });
      proc.unref();
    } catch {
      console.log(`   📄  Login UI saved to: ${loginUiPath}`);
    }
  }

  // ── Step 8: Post per-story Jira comments ──────────────────
  console.log('\n💬  Step 8 – Posting results to all Jira stories…');
  const allKeys = stories.map((s) => s.issueKey);

  for (const story of stories) {
    const { issueKey } = story;
    const issue = issueMap[issueKey];

    // Skip posting to invalid keys — they don't exist in Jira
    if (issue === null) {
      console.log(`   ⏭️   Skipping Jira comment for invalid key "${issueKey}"`);
      continue;
    }

    if (reportResult?.summary) {
      // Rich comment with ADF test-results table
      const adfBody = buildJiraAdfBody(reportResult.summary, issueKey, allKeys);
      await postComment(issueKey, '', adfBody);
    } else {
      // Fallback plain-text comment if results.json wasn't available
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
