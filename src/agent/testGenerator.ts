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
You are a QA engineer. Output ONLY valid TypeScript. No markdown, no prose, no backticks.
Start with imports.

APIs available:
  GET /api/users → { users: Array<{ id, name, export_status, username, password }> }
  GET /api/login?username=u&password=p → { success: boolean, message: string, exportStatus?: string }

Server messages (use these exactly):
  Success : "Login successful. Welcome!"
  Blocked : "Only US Persons are allowed to watch this demo."

Rules you MUST follow:
  1. Call GET /api/users at the start of each describe block to get users dynamically.
  2. Use the password field from /api/users directly. Never derive or hardcode passwords.
  3. Never hardcode usernames, names, or any credentials.
  4. Use request fixture (APIRequestContext). Never use page.goto.
  5. YOU MUST ONLY IMPLEMENT THE EXACT TEST CASES LISTED IN THE USER PROMPT.
     Do NOT add edge cases, integrity checks, dynamic loops, extra describes,
     or ANY test that is not explicitly named in the list below.
     One plain-English test case = one test() block. No more, no less.
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

  // When plain-English test cases are provided, omit the AC entirely
  // so Claude cannot expand beyond what was explicitly requested
  const acLine = plainEnglishTestCases.length > 0
    ? 'AC: (ignored — implement the plain-English test cases below ONLY)'
    : `AC: ${issue.acceptanceCriteria || '(see description)'}`;

  const userPrompt = `
Jira Story : ${issue.key}
Summary    : ${issue.summary}
${acLine}
${testCaseSection}

Generate the complete Playwright TypeScript test file now.
The tests MUST use GET /api/users at runtime to discover all users dynamically.
Never hardcode any username, password, or name.
IMPORTANT: Only implement the test cases listed above. Do not add any others.
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

  let cleaned = text
    .replace(/^```(?:typescript|ts)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  // Guard against duplicated output (Claude occasionally repeats itself)
  // Find the first import statement and check if it appears twice
  const firstImport = cleaned.indexOf('import ');
  const secondImport = cleaned.indexOf('import ', firstImport + 10);
  if (secondImport !== -1) {
    // Check if the second import block is a near-duplicate of the first half
    const firstHalf  = cleaned.substring(0, secondImport).trim();
    const secondHalf = cleaned.substring(secondImport).trim();
    if (secondHalf.startsWith('import ') && firstHalf.length > 100) {
      // Keep whichever half is longer and more complete
      cleaned = firstHalf.length >= secondHalf.length ? firstHalf : secondHalf;
    }
  }

  return cleaned;
}
