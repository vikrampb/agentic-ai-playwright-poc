/**
 * src/agent/testGenerator.ts
 * Uses the Anthropic SDK (with the Atlassian MCP) to read a Jira story
 * and synthesise Playwright TypeScript test code.
 */
import Anthropic from '@anthropic-ai/sdk';
import { JiraIssue } from '../jira/client';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `
You are an expert QA engineer who writes Playwright TypeScript tests.
Given a Jira user story, you MUST output ONLY valid TypeScript code – no markdown,
no prose, no backtick fences, just raw TypeScript starting with the imports.

Rules:
- Import from "@playwright/test" only.
- The login endpoint is GET /api/login?username=<u>&password=<p>
  It returns JSON: { success: boolean, message: string, exportStatus?: string }
- A US_PERSON login must return { success: true }
- A NON_US_PERSON login must return { success: false } with a graceful message.
- Use the credentials embedded in the test data comments below; do NOT hard-code them.
- Write one describe block per scenario (US person, Non-US person).
- Use Playwright's APIRequestContext (request fixture) – NOT page.goto.
`.trim();

export async function generatePlaywrightTests(
  issue: JiraIssue,
  testData: Array<{ username: string; password: string; exportStatus: string; name: string }>,
): Promise<string> {
  const userPrompt = `
Jira Story: ${issue.key}
Summary: ${issue.summary}
Description: ${issue.description}
Acceptance Criteria: ${issue.acceptanceCriteria || '(see description)'}

Test data from the embedded SQLite database:
${testData.map((u) => `  - name="${u.name}" username="${u.username}" password="${u.password}" export_status="${u.exportStatus}"`).join('\n')}

Generate the complete Playwright TypeScript test file now.
`.trim();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  // Strip accidental markdown fences
  return text.replace(/^```(?:typescript|ts)?\n?/i, '').replace(/\n?```$/i, '').trim();
}
