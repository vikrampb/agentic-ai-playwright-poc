import { test, expect, APIRequestContext } from '@playwright/test';

interface User {
  id: number;
  name: string;
  export_status: string;
  username: string;
  password: string;
}

interface UsersResponse {
  users: User[];
}

interface LoginResponse {
  success: boolean;
  message: string;
  exportStatus?: string;
}

test.describe('AQA-1: Verify only US Users are able to log in to the application', () => {
  let users: User[];

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    expect(response.ok()).toBeTruthy();
    const body: UsersResponse = await response.json();
    users = body.users;
    expect(users.length).toBeGreaterThan(0);
  });

  test('Login is successful if the export_status of the user attempting to login is US Person', async ({ request }: { request: APIRequestContext }) => {
    const usPersons = users.filter((u) => u.export_status === 'US_PERSON');

    for (const user of usPersons) {
      const response = await request.get(`/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`);
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('Login successful. Welcome!');
    }
  });

  test('Login fails if the export_status of the user attempting to login is Non US Person', async ({ request }: { request: APIRequestContext }) => {
    const nonUsPersons = users.filter((u) => u.export_status === 'NON_US_PERSON');

    for (const user of nonUsPersons) {
      const response = await request.get(`/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`);
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain('Only US Persons');
    }
  });
});