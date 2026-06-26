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
    Response: { users: Array<{ id, name, export_status, username }> }
    export_status is either "US_PERSON" or "NON_US_PERSON"

  GET /api/login?username=<u>&password=<p>
    Response: { success: boolean, message: string, exportStatus?: string }

IMPORTANT — tests must be fully dynamic:
  1. At the START of each describe block, call GET /api/users to load all users.
  2. Derive the password by appending "2025!" to the user's name with no spaces,
     e.g. name "Captain America" → password "CaptainAmerica2025!" — but this is
     just a fallback. The real passwords in the DB may differ. Instead, attempt
     login and interpret the response: success:true = US_PERSON allowed,
     success:false with exportStatus NON_US_PERSON = correctly blocked.
  3. NEVER hardcode usernames, passwords, or names in the test assertions.
  4. Loop over all users returned by /api/users. For each user:
       - If export_status === "US_PERSON"  → expect login success:true
       - If export_status === "NON_US_PERSON" → expect login success:false
         AND expect message to contain "Only US Persons"
  5. Use test.describe and test() (not it()) blocks.
  6. Use Playwright's APIRequestContext (request fixture) only — NOT page.goto.
  7. The password for each test user is: <FirstName><LastName>2025! with no spaces.
     E.g. "Captain America" → "CaptainAmerica2025!", "Green Goblin" → "GreenGoblin2025!"
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
