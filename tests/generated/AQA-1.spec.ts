import { test, expect, APIRequestContext } from '@playwright/test';

interface User {
  id: number | string;
  name: string;
  export_status: string;
  username: string;
  password: string;
}

test.describe('AQA-1: Verify only US Users are able to log in to the application', () => {
  let users: User[];

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    const body = await response.json();
    users = body.users;
  });

  test('Login is successful if the export_status of the user attempting to login is US Person', async ({ request }: { request: APIRequestContext }) => {
    const usUser = users.find((u) => u.export_status === 'US Person');
    expect(usUser, 'Expected at least one US Person user').toBeDefined();

    const response = await request.get(`/api/login?username=${usUser!.username}&password=${usUser!.password}`);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.message).toBe('Login successful. Welcome!');
  });

  test('Login fails if the export_status of the user attempting to login is Non US Person', async ({ request }: { request: APIRequestContext }) => {
    const nonUsUser = users.find((u) => u.export_status === 'Non US Person');
    expect(nonUsUser, 'Expected at least one Non US Person user').toBeDefined();

    const response = await request.get(`/api/login?username=${nonUsUser!.username}&password=${nonUsUser!.password}`);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.message).toBe('Only US Persons are allowed to watch this demo.');
  });
});