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

  test.describe('US_PERSON users: login should succeed', () => {
    test('All US_PERSON users can log in and receive "Login Successful!" message', async ({ request }: { request: APIRequestContext }) => {
      const usPersonUsers = allUsers.filter((u) => u.export_status === 'US_PERSON');

      for (const user of usPersonUsers) {
        const password = derivePassword(user.name);
        const loginResponse = await request.get(
          `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(password)}`
        );

        expect(loginResponse.ok()).toBeTruthy();
        const loginBody = await loginResponse.json();

        expect(
          loginBody.success,
          `Expected US_PERSON user "${user.username}" (export_status: ${user.export_status}) to log in successfully, but got success: ${loginBody.success}. Message: "${loginBody.message}"`
        ).toBe(true);

        expect(
          loginBody.message,
          `Expected success message for US_PERSON user "${user.username}" to be "Login Successful!" but got "${loginBody.message}"`
        ).toBe('Login Successful!');
      }
    });
  });

  test.describe('NON_US_PERSON users: login should fail', () => {
    test('All NON_US_PERSON users are blocked and receive "Only US Persons" error message', async ({ request }: { request: APIRequestContext }) => {
      const nonUsPersonUsers = allUsers.filter((u) => u.export_status === 'NON_US_PERSON');

      for (const user of nonUsPersonUsers) {
        const password = derivePassword(user.name);
        const loginResponse = await request.get(
          `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(password)}`
        );

        expect(loginResponse.ok()).toBeTruthy();
        const loginBody = await loginResponse.json();

        expect(
          loginBody.success,
          `Expected NON_US_PERSON user "${user.username}" (export_status: ${user.export_status}) to be blocked, but got success: ${loginBody.success}. Message: "${loginBody.message}"`
        ).toBe(false);

        expect(
          loginBody.message,
          `Expected error message for NON_US_PERSON user "${user.username}" to contain "Only US Persons" but got "${loginBody.message}"`
        ).toContain('Only US Persons');
      }
    });
  });

  test.describe('Dynamic per-user login validation (all users)', () => {
    test('Each user login outcome matches their export_status', async ({ request }: { request: APIRequestContext }) => {
      for (const user of allUsers) {
        const password = derivePassword(user.name);
        const loginResponse = await request.get(
          `/api/login?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(password)}`
        );

        expect(loginResponse.ok()).toBeTruthy();
        const loginBody = await loginResponse.json();

        if (user.export_status === 'US_PERSON') {
          expect(
            loginBody.success,
            `[US_PERSON] User "${user.username}" should be able to log in. Got success: ${loginBody.success}, message: "${loginBody.message}"`
          ).toBe(true);

          expect(
            loginBody.message,
            `[US_PERSON] User "${user.username}" should see "Login Successful!" but got "${loginBody.message}"`
          ).toBe('Login Successful!');

        } else if (user.export_status === 'NON_US_PERSON') {
          expect(
            loginBody.success,
            `[NON_US_PERSON] User "${user.username}" should be blocked from logging in. Got success: ${loginBody.success}, message: "${loginBody.message}"`
          ).toBe(false);

          expect(
            loginBody.message,
            `[NON_US_PERSON] User "${user.username}" should see an "Only US Persons" message but got "${loginBody.message}"`
          ).toContain('Only US Persons');

          expect(
            loginBody.exportStatus ?? loginBody.message,
            `[NON_US_PERSON] Expected exportStatus or message to indicate NON_US_PERSON block for user "${user.username}"`
          ).toBeTruthy();

        } else {
          throw new Error(
            `Unexpected export_status "${user.export_status}" for user "${user.username}". ` +
            `Only "US_PERSON" and "NON_US_PERSON" are valid values.`
          );
        }
      }
    });
  });

  test.describe('AC: Login Successful message for US_PERSON (AC-1)', () => {
    test('A US_PERSON user who logs in successfully is shown "Login Successful!"', async ({ request }: { request: APIRequestContext }) => {
      const usPersonUser = allUsers.find((u) => u.export_status === 'US_PERSON');

      expect(
        usPersonUser,
        'Expected at least one US_PERSON user to exist in /api/users'
      ).toBeDefined();

      if (!usPersonUser) return;

      const password = derivePassword(usPersonUser.name);
      const loginResponse = await request.get(
        `/api/login?username=${encodeURIComponent(usPersonUser.username)}&password=${encodeURIComponent(password)}`
      );

      expect(loginResponse.ok()).toBeTruthy();
      const loginBody = await loginResponse.json();

      expect(
        loginBody.success,
        `Expected US_PERSON user "${usPersonUser.username}" to log in successfully`
      ).toBe(true);

      expect(
        loginBody.message,
        `Expected the success message to be exactly "Login Successful!" for user "${usPersonUser.username}"`
      ).toBe('Login Successful!');
    });
  });

  test.describe('AC: Login Blocked message for NON_US_PERSON (AC-2)', () => {
    test('A NON_US_PERSON user who attempts login is shown "Only U.S. Persons are permitted to login."', async ({ request }: { request: APIRequestContext }) => {
      const nonUsPersonUser = allUsers.find((u) => u.export_status === 'NON_US_PERSON');

      expect(
        nonUsPersonUser,
        'Expected at least one NON_US_PERSON user to exist in /api/users'
      ).toBeDefined();

      if (!nonUsPersonUser) return;

      const password = derivePassword(nonUsPersonUser.name);
      const loginResponse = await request.get(
        `/api/login?username=${encodeURIComponent(nonUsPersonUser.username)}&password=${encodeURIComponent(password)}`
      );

      expect(loginResponse.ok()).toBeTruthy();
      const loginBody = await loginResponse.json();

      expect(
        loginBody.success,
        `Expected NON_US_PERSON user "${nonUsPersonUser.username}" to be blocked from logging in`
      ).toBe(false);

      expect(
        loginBody.message,
        `Expected the error message for NON_US_PERSON user "${nonUsPersonUser.username}" to be "Only U.S. Persons are permitted to login." but got "${loginBody.message}"`
      ).toBe('Only U.S. Persons are permitted to login.');
    });
  });
});