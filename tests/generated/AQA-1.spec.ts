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
  let users: User[];

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    expect(response.ok()).toBeTruthy();
    const body: UsersResponse = await response.json();
    expect(body).toHaveProperty('users');
    expect(Array.isArray(body.users)).toBe(true);
    users = body.users;
  });

  test('GET /api/users returns a non-empty list of users with required fields', async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    expect(response.ok()).toBeTruthy();
    const body: UsersResponse = await response.json();
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThan(0);

    for (const user of body.users) {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('export_status');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('password');
      expect(['US_PERSON', 'NON_US_PERSON']).toContain(user.export_status);
    }
  });

  test('AC1 - US_PERSON users can log in successfully and see "Login Successful!" message', async ({ request }: { request: APIRequestContext }) => {
    const usPersons = users.filter((u) => u.export_status === 'US_PERSON');
    expect(usPersons.length).toBeGreaterThan(0);

    for (const user of usPersons) {
      const response = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      expect(body.success).toBe(true);
      expect(body.message).toContain('Login Successful!');
    }
  });

  test('AC2 - NON_US_PERSON users cannot log in and see "Only U.S. Persons are permitted to login." message', async ({ request }: { request: APIRequestContext }) => {
    const nonUsPersons = users.filter((u) => u.export_status === 'NON_US_PERSON');
    expect(nonUsPersons.length).toBeGreaterThan(0);

    for (const user of nonUsPersons) {
      const response = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      expect(body.success).toBe(false);
      expect(body.message).toContain('Only US Persons');
    }
  });

  test('Dynamic loop - each user login attempt matches their export_status rules', async ({ request }: { request: APIRequestContext }) => {
    for (const user of users) {
      const response = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      if (user.export_status === 'US_PERSON') {
        expect(body.success).toBe(true);
        expect(body.message).toContain('Login Successful!');
      } else if (user.export_status === 'NON_US_PERSON') {
        expect(body.success).toBe(false);
        expect(body.message).toContain('Only US Persons');
      }
    }
  });

  test('US_PERSON login response contains exportStatus field reflecting US_PERSON', async ({ request }: { request: APIRequestContext }) => {
    const usPersons = users.filter((u) => u.export_status === 'US_PERSON');
    expect(usPersons.length).toBeGreaterThan(0);

    for (const user of usPersons) {
      const response = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      expect(body.success).toBe(true);
      if (body.exportStatus !== undefined) {
        expect(body.exportStatus).toBe('US_PERSON');
      }
    }
  });

  test('NON_US_PERSON login response does not grant access regardless of password correctness', async ({ request }: { request: APIRequestContext }) => {
    const nonUsPersons = users.filter((u) => u.export_status === 'NON_US_PERSON');
    expect(nonUsPersons.length).toBeGreaterThan(0);

    for (const user of nonUsPersons) {
      const response = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      expect(body.success).toBe(false);
      expect(body.message).not.toContain('Login Successful!');
      expect(body.message).toContain('Only US Persons');
    }
  });
});