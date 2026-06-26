/**
 * src/agent/testGenerator.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { JiraIssue } from '../jira/client';
import { PlainEnglishTestCase } from './prompt';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `
You are an expert QA engineer who writes Playwright TypeScript tests.
You MUST output ONLY valid TypeScript code – no markdown, no prose,
no backtick fences. Start directly with the import statements.

API under test:
  GET /api/login?username=<u>&password=<p>
  Response: { success: boolean, message: string, exportStatus?: string }

Rules:
- Import from "@playwright/test" only.
- Use Playwright's APIRequestContext (request fixture) — NOT page.goto.
- Write one describe block per logical scenario or test case provided.
- Use ONLY the credentials supplied in the test data section.
- For each plain-English test case given, produce one or more test blocks
  that precisely verify the described behaviour.
- If no plain-English test cases are supplied, derive tests from the Jira AC.
`.trim();

export async function generatePlaywrightTests(
  issue: JiraIssue,
  testData: Array<{ username: string; password: string; exportStatus: string; name: string }>,
  plainEnglishTestCases: PlainEnglishTestCase[] = [],
): Promise<string> {
  const testCaseSection =
    plainEnglishTestCases.length > 0
      ? `\nPlain-English test cases to implement:\n` +
        plainEnglishTestCases
          .map(
            (tc, i) =>
              `  ${i + 1}. Description : ${tc.description}\n` +
              `     Endpoint    : ${tc.endpoint}\n` +
              `     Expected    : ${tc.expectedOutcome}`,
          )
          .join('\n\n')
      : '\n(No plain-English test cases — use the Jira AC above.)';

  const userPrompt = `
Jira Story : ${issue.key}
Summary    : ${issue.summary}
Description: ${issue.description}
AC         : ${issue.acceptanceCriteria || '(see description)'}

Test data (from embedded SQLite):
${testData
  .map(
    (u) =>
      `  - name="${u.name}" username="${u.username}" ` +
      `password="${u.password}" export_status="${u.exportStatus}"`,
  )
  .join('\n')}
${testCaseSection}

Generate the complete Playwright TypeScript test file now.
`.trim();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
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
