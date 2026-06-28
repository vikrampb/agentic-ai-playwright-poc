/**
 * src/agent/testGenerator.ts
 * ─────────────────────────────────────────────────────────────
 * Generates Playwright TypeScript test files.
 *
 * Strategy: use a fixed scaffold template so the test structure
 * is 100% controlled by the agent. Claude is only called to
 * generate the assertion body for each plain-English test case.
 * This prevents Claude from adding unrequested tests.
 *
 * If no plain-English test cases are provided, falls back to
 * two default tests derived from the Jira story export-control AC.
 */
import Anthropic from '@anthropic-ai/sdk';
import { JiraIssue } from '../jira/client';
import { PlainEnglishTestCase } from './prompt';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Fixed file header — always the same ───────────────────────────────────────
const FILE_HEADER = `import { test, expect, APIRequestContext } from '@playwright/test';

interface User {
  id:            number;
  name:          string;
  export_status: 'US_PERSON' | 'NON_US_PERSON';
  username:      string;
  password:      string;
}

interface LoginResponse {
  success:       boolean;
  message:       string;
  exportStatus?: string;
}

async function getUsers(request: APIRequestContext): Promise<User[]> {
  const res  = await request.get('/api/users');
  const body = await res.json();
  return body.users as User[];
}

async function login(
  request:  APIRequestContext,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const res = await request.get('/api/login', { params: { username, password } });
  return res.json();
}
`;

// ── Default tests used when no plain-English cases are provided ───────────────
function defaultTestBlocks(issueKey: string): string {
  return `
test.describe('${issueKey} – Export Control Login', () => {
  test('US_PERSON user login should succeed', async ({ request }) => {
    const users  = await getUsers(request);
    const user   = users.find((u) => u.export_status === 'US_PERSON');
    expect(user, 'No US_PERSON user found in /api/users').toBeDefined();

    const result = await login(request, user!.username, user!.password);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Login successful');
  });

  test('NON_US_PERSON user login should be denied with a clear message', async ({ request }) => {
    const users  = await getUsers(request);
    const user   = users.find((u) => u.export_status === 'NON_US_PERSON');
    expect(user, 'No NON_US_PERSON user found in /api/users').toBeDefined();

    const result = await login(request, user!.username, user!.password);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Only US Persons');
  });
});
`.trimStart();
}

// ── Ask Claude to generate ONLY the body of a single test ─────────────────────
async function generateTestBody(
  testCase: PlainEnglishTestCase,
  issueKey: string,
): Promise<string> {
  const prompt = `
You are writing the BODY of a single Playwright TypeScript test function.
Output ONLY the statements that go inside the async ({ request }) => { } block.
No function signature, no describe block, no imports, no comments.

Available helpers already defined above:
  getUsers(request) → Promise<User[]>
    User: { id, name, export_status: "US_PERSON"|"NON_US_PERSON", username, password }

  login(request, username, password) → Promise<LoginResponse>
    LoginResponse: { success: boolean, message: string, exportStatus?: string }

EXACT server messages — use these strings character-for-character:
  US_PERSON success : "Login successful. Welcome!"
  NON_US_PERSON blocked: "Only US Persons are allowed to watch this demo."

For blocked users always assert:
  expect(response.message).toContain("Only US Persons are allowed to watch this demo.");
For successful logins always assert:
  expect(response.message).toContain("Login successful");

Test case to implement:
  Description : ${testCase.description}
  Endpoint    : ${testCase.endpoint}
  Expected    : ${testCase.expectedOutcome}

Write only the test body statements. Use the password field from getUsers() directly.
`.trim();

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 800,
    messages:   [{ role: 'user', content: prompt }],
  });

  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .replace(/^```(?:typescript|ts)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generatePlaywrightTests(
  issue: JiraIssue,
  plainEnglishTestCases: PlainEnglishTestCase[] = [],
): Promise<string> {
  // No plain-English cases → use the fixed default tests
  if (plainEnglishTestCases.length === 0) {
    return FILE_HEADER + '\n' + defaultTestBlocks(issue.key);
  }

  // Build one test block per plain-English case, Claude only writes the body
  const testBlocks: string[] = [];

  for (const tc of plainEnglishTestCases) {
    console.log(`         🤖  Generating body for: "${tc.description}"`);
    const body = await generateTestBody(tc, issue.key);

    const block = `
  test('${tc.description}', async ({ request }) => {
${body.split('\n').map((l) => '    ' + l).join('\n')}
  });`;
    testBlocks.push(block);
  }

  const describeBlock = `
test.describe('${issue.key} – ${issue.summary}', () => {
${testBlocks.join('\n')}
});
`.trimStart();

  return FILE_HEADER + '\n' + describeBlock;
}
