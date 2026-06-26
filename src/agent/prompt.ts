/**
 * src/agent/prompt.ts
 * Terminal prompt utilities for the interactive demo mode.
 */
import * as readline from 'readline';

export interface PlainEnglishTestCase {
  description:     string;
  endpoint:        string;
  expectedOutcome: string;
}

export interface StoryInput {
  issueKey:               string;
  plainEnglishTestCases:  PlainEnglishTestCase[];
}

function createRL(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

export async function collectStories(): Promise<StoryInput[]> {
  const rl      = createRL();
  const stories: StoryInput[] = [];

  console.log('\n' + '─'.repeat(56));
  console.log('  🎤  INTERACTIVE DEMO MODE');
  console.log('─'.repeat(56));
  console.log('  Enter Jira issue keys one at a time.');
  console.log('  For each story you can add plain-English test cases');
  console.log('  which Claude will convert to Playwright TypeScript.');
  console.log('  Press ENTER with an empty key to start the pipeline.');
  console.log('─'.repeat(56) + '\n');

  let storyNum = 1;

  while (true) {
    const issueKey = await ask(rl, `  Story ${storyNum} – Jira issue key (or ENTER to finish): `);
    if (!issueKey) break;

    console.log(`\n  📝  Adding plain-English test cases for ${issueKey}`);
    console.log('  Press ENTER with an empty description to move on.\n');

    const testCases: PlainEnglishTestCase[] = [];
    let caseNum = 1;

    while (true) {
      const description = await ask(rl, `    Test case ${caseNum} description (or ENTER to finish): `);
      if (!description) break;

      const endpoint = await ask(rl, `    Endpoint [default: GET /api/login]: `);
      const expectedOutcome = await ask(rl, `    Expected outcome: `);

      testCases.push({ description, endpoint: endpoint || 'GET /api/login', expectedOutcome });
      console.log(`    ✓  Test case ${caseNum} recorded\n`);
      caseNum++;
    }

    stories.push({ issueKey, plainEnglishTestCases: testCases });
    console.log(
      `\n  ✅  Story ${issueKey} added` +
      (testCases.length ? ` with ${testCases.length} custom test case(s)` : ' (using Jira AC only)') + '\n',
    );
    storyNum++;
  }

  rl.close();

  if (stories.length === 0) {
    const envKey = process.env.JIRA_ISSUE_KEY;
    if (envKey) {
      console.log(`  ℹ️   No stories entered — using JIRA_ISSUE_KEY from .env (${envKey})\n`);
      stories.push({ issueKey: envKey, plainEnglishTestCases: [] });
    } else {
      throw new Error('No Jira issue keys provided and JIRA_ISSUE_KEY is not set in .env');
    }
  }

  return stories;
}

export function printStorySummary(stories: StoryInput[]): void {
  console.log('\n' + '─'.repeat(56));
  console.log(`  📋  Pipeline will process ${stories.length} story/stories:`);
  for (const s of stories) {
    console.log(`\n    • ${s.issueKey}`);
    if (s.plainEnglishTestCases.length) {
      console.log(`      Custom test cases (${s.plainEnglishTestCases.length}):`);
      for (const tc of s.plainEnglishTestCases) {
        console.log(`        – ${tc.description}`);
      }
    } else {
      console.log('      (Claude will derive tests from Jira AC only)');
    }
  }
  console.log('\n' + '─'.repeat(56) + '\n');
}
