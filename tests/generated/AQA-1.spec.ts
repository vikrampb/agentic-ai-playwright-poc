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
  let allUsers: User[] = [];

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    expect(response.ok()).toBeTruthy();
    const body: UsersResponse = await response.json();
    expect(body).toHaveProperty('users');
    expect(Array.isArray(body.users)).toBe(true);
    allUsers = body.users;
  });

  test('GET /api/users should return a non-empty list of users with required fields', async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    expect(response.ok()).toBeTruthy();
    const body: UsersResponse = await response.json();
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

  test('Login succeeds for all US_PERSON users', async ({ request }: { request: APIRequestContext }) => {
    const usPersonUsers = allUsers.filter((u) => u.export_status === 'US_PERSON');
    expect(usPersonUsers.length).toBeGreaterThan(0);

    for (const user of usPersonUsers) {
      const response = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      expect(body.success).toBe(true);
      expect(body.message).toBe('Login successful. Welcome!');
    }
  });

  test('Login fails for all NON_US_PERSON users', async ({ request }: { request: APIRequestContext }) => {
    const nonUsPersonUsers = allUsers.filter((u) => u.export_status === 'NON_US_PERSON');
    expect(nonUsPersonUsers.length).toBeGreaterThan(0);

    for (const user of nonUsPersonUsers) {
      const response = await request.get(
        `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      expect(body.success).toBe(false);
      expect(body.message).toContain('Only US Persons');
    }
  });

  test.describe('Dynamic per-user login validation', () => {
    test('Each user receives the correct login response based on their export_status', async ({ request }: { request: APIRequestContext }) => {
      expect(allUsers.length).toBeGreaterThan(0);

      for (const user of allUsers) {
        const response = await request.get(
          `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}`
        );
        expect(response.ok()).toBeTruthy();
        const body: LoginResponse = await response.json();

        if (user.export_status === 'US_PERSON') {
          expect(body.success).toBe(true);
          expect(body.message).toBe('Login successful. Welcome!');
        } else if (user.export_status === 'NON_US_PERSON') {
          expect(body.success).toBe(false);
          expect(body.message).toContain('Only US Persons');
        }
      }
    });
  });

  test.describe('AC: US_PERSON login acceptance criteria', () => {
    test('A US_PERSON user is shown a success message upon login', async ({ request }: { request: APIRequestContext }) => {
      const usPersonUser = allUsers.find((u) => u.export_status === 'US_PERSON');
      expect(usPersonUser).toBeDefined();

      const response = await request.get(
        `/api/login?username=${encodeURIComponent(usPersonUser!.username)}&password=${encodeURIComponent(usPersonUser!.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      expect(body.success).toBe(true);
      expect(body.message).toBe('Login successful. Welcome!');
    });
  });

  test.describe('AC: NON_US_PERSON login acceptance criteria', () => {
    test('A NON_US_PERSON user is shown an error message upon login', async ({ request }: { request: APIRequestContext }) => {
      const nonUsPersonUser = allUsers.find((u) => u.export_status === 'NON_US_PERSON');
      expect(nonUsPersonUser).toBeDefined();

      const response = await request.get(
        `/api/login?username=${encodeURIComponent(nonUsPersonUser!.username)}&password=${encodeURIComponent(nonUsPersonUser!.password)}`
      );
      expect(response.ok()).toBeTruthy();
      const body: LoginResponse = await response.json();

      expect(body.success).toBe(false);
      expect(body.message).toContain('Only US Persons');
    });
  });
});