import { test, expect, APIRequestContext } from '@playwright/test';

test.describe('AQA-1: Verify only US Users are able to log in to the application', () => {
  let users: Array<{ id: string; name: string; export_status: string; username: string; password: string }>;

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    const data = await response.json();
    users = data.users;
  });

  test('Login is successful if the export_status of the user attempting to login is US_PERSON', async ({ request }: { request: APIRequestContext }) => {
    const usUser = users.find((u) => u.export_status === 'US_PERSON');
    expect(usUser, 'Expected at least one US_PERSON user').toBeDefined();

    const response = await request.get(`/api/login?username=${usUser!.username}&password=${usUser!.password}`);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.message).toBe('Login successful. Welcome!');
  });

  test('Login fails if the export_status of the user attempting to login is NON_US_PERSON', async ({ request }: { request: APIRequestContext }) => {
    const nonUsUser = users.find((u) => u.export_status === 'NON_US_PERSON');
    expect(nonUsUser, 'Expected at least one NON_US_PERSON user').toBeDefined();

    const response = await request.get(`/api/login?username=${nonUsUser!.username}&password=${nonUsUser!.password}`);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.message).toBe('Only US Persons are allowed to watch this demo.');
  });
});