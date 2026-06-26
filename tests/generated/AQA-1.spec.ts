import { test, expect, APIRequestContext } from '@playwright/test';

interface User {
  id: number | string;
  name: string;
  export_status: string;
  username: string;
}

function derivePassword(name: string): string {
  return name.split(' ').join('') + '2025!';
}

test.describe('AQA-1: Verify only US Users are able to log in to the application', () => {
  let allUsers: User[] = [];

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/users');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('users');
    expect(Array.isArray(body.users)).toBe(true);
    allUsers = body.users;
    expect(allUsers.length).toBeGreaterThan(0);
  });

  test.describe('US_PERSON users should be able to log in successfully', () => {
    test('Each US_PERSON user receives success:true and "Successfully logged in." message', async ({ request }: { request: APIRequestContext }) => {
      const usPersonUsers = allUsers.filter((u) => u.export_status === 'US_PERSON');

      for (const user of usPersonUsers) {
        const password = derivePassword(user.name);

        const response = await request.get(`/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(password)}`);
        expect(response.ok(), `Expected HTTP OK for US_PERSON user: ${user.username}`).toBeTruthy();

        const body = await response.json();

        expect(
          body.success,
          `Expected success:true for US_PERSON user "${user.name}" (username: ${user.username})`
        ).toBe(true);

        expect(
          body.message,
          `Expected "Successfully logged in." message for US_PERSON user "${user.name}" (username: ${user.username})`
        ).toContain('Successfully logged in.');
      }
    });
  });

  test.describe('NON_US_PERSON users should be blocked from logging in', () => {
    test('Each NON_US_PERSON user receives success:false and "Only US Persons" error message', async ({ request }: { request: APIRequestContext }) => {
      const nonUsPersonUsers = allUsers.filter((u) => u.export_status === 'NON_US_PERSON');

      for (const user of nonUsPersonUsers) {
        const password = derivePassword(user.name);

        const response = await request.get(`/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(password)}`);
        expect(response.ok(), `Expected HTTP OK (even for blocked user) for NON_US_PERSON user: ${user.username}`).toBeTruthy();

        const body = await response.json();

        expect(
          body.success,
          `Expected success:false for NON_US_PERSON user "${user.name}" (username: ${user.username})`
        ).toBe(false);

        expect(
          body.message,
          `Expected "Only US Persons" in error message for NON_US_PERSON user "${user.name}" (username: ${user.username})`
        ).toContain('Only US Persons');
      }
    });
  });

  test.describe('Dynamic per-user login validation loop', () => {
    test('All users from /api/users are validated against their export_status', async ({ request }: { request: APIRequestContext }) => {
      expect(allUsers.length, 'Expected at least one user to be returned from /api/users').toBeGreaterThan(0);

      for (const user of allUsers) {
        const password = derivePassword(user.name);

        const response = await request.get(
          `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(password)}`
        );

        expect(
          response.ok(),
          `Expected HTTP OK response for user "${user.name}" (username: ${user.username}, export_status: ${user.export_status})`
        ).toBeTruthy();

        const body = await response.json();

        if (user.export_status === 'US_PERSON') {
          expect(
            body.success,
            `US_PERSON user "${user.name}" (username: ${user.username}) should be able to log in (success:true)`
          ).toBe(true);

          expect(
            body.message,
            `US_PERSON user "${user.name}" (username: ${user.username}) should see "Successfully logged in."`
          ).toContain('Successfully logged in.');

        } else if (user.export_status === 'NON_US_PERSON') {
          expect(
            body.success,
            `NON_US_PERSON user "${user.name}" (username: ${user.username}) should be blocked (success:false)`
          ).toBe(false);

          expect(
            body.message,
            `NON_US_PERSON user "${user.name}" (username: ${user.username}) should see "Only US Persons" error message`
          ).toContain('Only US Persons');

          if (body.exportStatus !== undefined) {
            expect(
              body.exportStatus,
              `NON_US_PERSON user "${user.name}" exportStatus field in response should reflect NON_US_PERSON`
            ).toBe('NON_US_PERSON');
          }
        } else {
          throw new Error(
            `Unexpected export_status "${user.export_status}" for user "${user.name}" (username: ${user.username}). ` +
            `Only "US_PERSON" or "NON_US_PERSON" are valid values.`
          );
        }
      }
    });
  });

  test.describe('AC Verification: Login success message for US_PERSON', () => {
    test('AC1 - US_PERSON user is shown "Successfully logged in." upon successful login', async ({ request }: { request: APIRequestContext }) => {
      const usPersonUsers = allUsers.filter((u) => u.export_status === 'US_PERSON');
      expect(
        usPersonUsers.length,
        'Expected at least one US_PERSON user to exist in /api/users'
      ).toBeGreaterThan(0);

      for (const user of usPersonUsers) {
        const password = derivePassword(user.name);

        const response = await request.get(
          `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(password)}`
        );

        expect(response.ok(), `HTTP response should be OK for US_PERSON user: ${user.username}`).toBeTruthy();

        const body = await response.json();

        expect(
          body.success,
          `Login should succeed (success:true) for US_PERSON user "${user.name}" (username: ${user.username})`
        ).toBe(true);

        expect(
          body.message,
          `US_PERSON user "${user.name}" should be shown "Successfully logged in." message`
        ).toContain('Successfully logged in.');
      }
    });
  });

  test.describe('AC Verification: Login failure message for NON_US_PERSON', () => {
    test('AC2 - NON_US_PERSON user is shown "Only U.S. Persons are permitted to login." upon failed login', async ({ request }: { request: APIRequestContext }) => {
      const nonUsPersonUsers = allUsers.filter((u) => u.export_status === 'NON_US_PERSON');
      expect(
        nonUsPersonUsers.length,
        'Expected at least one NON_US_PERSON user to exist in /api/users'
      ).toBeGreaterThan(0);

      for (const user of nonUsPersonUsers) {
        const password = derivePassword(user.name);

        const response = await request.get(
          `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(password)}`
        );

        expect(response.ok(), `HTTP response should be OK even for blocked NON_US_PERSON user: ${user.username}`).toBeTruthy();

        const body = await response.json();

        expect(
          body.success,
          `Login should fail (success:false) for NON_US_PERSON user "${user.name}" (username: ${user.username})`
        ).toBe(false);

        expect(
          body.message,
          `NON_US_PERSON user "${user.name}" should be shown "Only US Persons" error message`
        ).toContain('Only US Persons');
      }
    });
  });
});