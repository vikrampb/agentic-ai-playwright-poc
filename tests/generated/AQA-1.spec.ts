import { test, expect, APIRequestContext } from '@playwright/test';

interface User {
  id: number;
  name: string;
  export_status: string;
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  exportStatus?: string;
}

interface UsersResponse {
  users: User[];
}

test.describe('AQA-1: Verify only US Users are able to log in to the application', () => {
  let users: User[] = [];

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    expect(response.ok()).toBeTruthy();
    const body: UsersResponse = await response.json();
    users = body.users;
    expect(users.length).toBeGreaterThan(0);
  });

  test('Dynamic loop: each US_PERSON user can login successfully; each NON_US_PERSON user cannot login', async ({ request }: { request: APIRequestContext }) => {
    for (const user of users) {
      const loginResponse = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(loginResponse.ok()).toBeTruthy();
      const loginBody: LoginResponse = await loginResponse.json();

      if (user.export_status === 'US_PERSON') {
        expect(loginBody.success).toBe(true);
        expect(loginBody.message).toBe('Login successful. Welcome!');
      } else if (user.export_status === 'NON_US_PERSON') {
        expect(loginBody.success).toBe(false);
        expect(loginBody.message).toContain('Only US Persons');
      }
    }
  });

  test('TC-1: Login is successful if the export_status of the user is US_PERSON', async ({ request }: { request: APIRequestContext }) => {
    const usPersonUsers = users.filter((u) => u.export_status === 'US_PERSON');
    expect(
      usPersonUsers.length,
      'Expected at least one US_PERSON user to exist in /api/users'
    ).toBeGreaterThan(0);

    for (const user of usPersonUsers) {
      const loginResponse = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(loginResponse.ok()).toBeTruthy();
      const loginBody: LoginResponse = await loginResponse.json();

      expect(
        loginBody.success,
        `Expected login success for US_PERSON user: ${user.username}`
      ).toBe(true);

      expect(
        loginBody.message,
        `Expected success message for US_PERSON user: ${user.username}`
      ).toContain('Login successful');
    }
  });

  test('TC-2: Login fails if the export_status of the user is NON_US_PERSON', async ({ request }: { request: APIRequestContext }) => {
    const nonUsPersonUsers = users.filter((u) => u.export_status === 'NON_US_PERSON');
    expect(
      nonUsPersonUsers.length,
      'Expected at least one NON_US_PERSON user to exist in /api/users'
    ).toBeGreaterThan(0);

    for (const user of nonUsPersonUsers) {
      const loginResponse = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(loginResponse.ok()).toBeTruthy();
      const loginBody: LoginResponse = await loginResponse.json();

      expect(
        loginBody.success,
        `Expected login failure for NON_US_PERSON user: ${user.username}`
      ).toBe(false);

      expect(
        loginBody.message,
        `Expected restriction message for NON_US_PERSON user: ${user.username}`
      ).toContain('Only US Persons');
    }
  });
});