/**
 * src/agent/testGenerator.ts
 * Generates Playwright TypeScript tests from a Jira story.
 * Tests are fully dynamic — they fetch users from GET /api/users
 * at runtime, so adding/changing DB records requires no test changes.
 */
import Anthropic from '@anthropic-ai/sdk';
import { JiraIssue } from '../jira/client';
import { PlainEnglishTestCase } from './prompt';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `
You are an expert QA engineer who writes Playwright TypeScript tests.
You MUST output ONLY valid TypeScript — no markdown, no prose, no backtick fences.
Start directly with the import statements.

API under test (base URL comes from the Playwright config):
  GET /api/users
    Response: { users: Array<{ id: number, name: string, export_status: string, username: string, password: string }> }
    export_status is either "US_PERSON" or "NON_US_PERSON"
    The password field contains the actual login password for each user.

  GET /api/login?username=<u>&password=<p>
    Response: { success: boolean, message: string, exportStatus?: string }

IMPORTANT — tests must be fully dynamic:
  1. At the START of each describe block, call GET /api/users to load all users.
  2. Use the password field returned by /api/users directly — NEVER derive or hardcode passwords.
  3. NEVER hardcode usernames, passwords, or names anywhere in the test file.
  4. Loop over all users returned by /api/users. For each user:
       - If export_status === "US_PERSON"  → expect login success:true
         The server returns message: "Login successful. Welcome!"
       - If export_status === "NON_US_PERSON" → expect login success:false
         The server returns message: "Only US Persons are allowed to watch this demo."
         Assert message contains "Only US Persons" (do NOT assert the full exact string)
  5. Use test.describe and test() blocks.
  6. Use Playwright's APIRequestContext (request fixture) only — NOT page.goto.
  7. Define a TypeScript interface for the User type from /api/users.
`.trim();

export async function generatePlaywrightTests(
  issue: JiraIssue,
  plainEnglishTestCases: PlainEnglishTestCase[] = [],
): Promise<string> {
  const testCaseSection =
    plainEnglishTestCases.length > 0
      ? `\nAdditional plain-English test cases to implement ON TOP of the dynamic loop:\n` +
        plainEnglishTestCases
          .map(
            (tc, i) =>
              `  ${i + 1}. ${tc.description}\n` +
              `     Endpoint : ${tc.endpoint}\n` +
              `     Expected : ${tc.expectedOutcome}`,
          )
          .join('\n\n')
      : '';

  const userPrompt = `
Jira Story : ${issue.key}
Summary    : ${issue.summary}
Description: ${issue.description}
AC         : ${issue.acceptanceCriteria || '(see description)'}
${testCaseSection}

Generate the complete Playwright TypeScript test file now.
The tests MUST use GET /api/users at runtime to discover all users dynamically.
Never hardcode any username, password, or name.
`.trim();

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 3000,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  return text
    .replace(/^```(?:typescript|ts)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}
