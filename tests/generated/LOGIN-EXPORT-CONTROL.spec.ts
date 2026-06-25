/**
 * tests/generated/LOGIN-EXPORT-CONTROL.spec.ts
 *
 * Playwright tests for:
 *   Story: Login Feature with Export Control
 *   AC:    Login succeeds for US Persons; fails gracefully for Non-US Persons.
 *
 * Test data (from embedded SQLite – data/users.db):
 *   - name="Captain America"  username="captain.america"  export_status="US_PERSON"
 *   - name="Green Goblin"     username="green.goblin"     export_status="NON_US_PERSON"
 */
import { test, expect, APIResponse } from '@playwright/test';

async function loginRequest(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  username: string,
  password: string,
): Promise<APIResponse> {
  return request.get('/api/login', {
    params: { username, password },
  });
}

// ── US Person (Captain America) ───────────────────────────────────────────────
test.describe('Login – US Person (Captain America)', () => {
  test('should return success:true for valid US-person credentials', async ({ request }) => {
    const response = await loginRequest(request, 'captain.america', 'Avengers2025!');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/login successful/i);
    expect(body.exportStatus).toBe('US_PERSON');
  });
});

// ── Non-US Person (Green Goblin) ──────────────────────────────────────────────
test.describe('Login – Non-US Person (Green Goblin)', () => {
  test('should return success:false with correct error message for non-US-person credentials', async ({ request }) => {
    const response = await loginRequest(request, 'green.goblin', 'OsCorp2025!');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.exportStatus).toBe('NON_US_PERSON');
    expect(body.message).toBe('Only US Persons are allowed to watch this demo.');
  });

  test('should NOT return success:true for a non-US-person user', async ({ request }) => {
    const response = await loginRequest(request, 'green.goblin', 'OsCorp2025!');
    const body = await response.json();
    expect(body.success).not.toBe(true);
  });
});

// ── Invalid credentials ───────────────────────────────────────────────────────
test.describe('Login – Invalid credentials', () => {
  test('should return success:false for unknown username', async ({ request }) => {
    const response = await loginRequest(request, 'unknown.user', 'WrongPass!');
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('should return success:false for correct username but wrong password', async ({ request }) => {
    const response = await loginRequest(request, 'captain.america', 'WrongPass!');
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
