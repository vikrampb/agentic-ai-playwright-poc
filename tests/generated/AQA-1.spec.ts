import { test, expect, APIRequestContext } from '@playwright/test';

test.describe('AQA-1: Verify only US Users are able to log in to the application', () => {
  let users: Array<{ id: string; name: string; export_status: string; username: string; password: string }>;

  test.beforeAll(async ({ request }) => {
    const response = await request.get('/api/users');
    const body = await response.json();
    users = body.users;
  });

  test('Login is successful if the export_status of the user attempting to login is US_PERSON', async ({ request }) => {
    const usUser = users.find((u) => u.export_status === 'US_PERSON');
    if (!usUser) {
      test.skip();
      return;
    }

    const response = await request.get(`/api/login?username=${encodeURIComponent(usUser.username)}&password=${encodeURIComponent(usUser.password)}`);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.message).toBe('Login successful. Welcome!');
  });

  test('Login fails if the export_status of the user attempting to login is NON_US_PERSON', async ({ request }) => {
    const nonUsUser = users.find((u) => u.export_status === 'NON_US_PERSON');
    if (!nonUsUser) {
      test.skip();
      return;
    }

    const response = await request.get(`/api/login?username=${encodeURIComponent(nonUsUser.username)}&password=${encodeURIComponent(nonUsUser.password)}`);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.message).toBe('Only US Persons are allowed to watch this demo.');
  });
});