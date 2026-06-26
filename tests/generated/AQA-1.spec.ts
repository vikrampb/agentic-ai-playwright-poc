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

  test.describe('US_PERSON users should be able to login successfully', () => {
    test('Each US_PERSON user receives success:true and "Login Successful!" message', async ({ request }: { request: APIRequestContext }) => {
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
          `Expected success:true for US_PERSON user "${user.name}" (username: "${user.username}"), but got success:${loginBody.success}. Message: "${loginBody.message}"`
        ).toBe(true);

        expect(
          loginBody.message,
          `Expected "Login Successful!" message for US_PERSON user "${user.name}" (username: "${user.username}"), but got: "${loginBody.message}"`
        ).toContain('Login Successful!');
      }
    });
  });

  test.describe('NON_US_PERSON users should be blocked from logging in', () => {
    test('Each NON_US_PERSON user receives success:false and "Only US Persons" error message', async ({ request }: { request: APIRequestContext }) => {
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
          `Expected success:false for NON_US_PERSON user "${user.name}" (username: "${user.username}"), but got success:${loginBody.success}. Message: "${loginBody.message}"`
        ).toBe(false);

        expect(
          loginBody.message,
          `Expected a blocking message containing "Only US Persons" for NON_US_PERSON user "${user.name}" (username: "${user.username}"), but got: "${loginBody.message}"`
        ).toContain('Only US Persons');

        expect(
          loginBody.message,
          `Expected full error message for NON_US_PERSON user "${user.name}" (username: "${user.username}"), but got: "${loginBody.message}"`
        ).toContain('Only U.S. Persons are permitted to login.');
      }
    });
  });

  test.describe('Dynamic loop: All users validated against their export_status', () => {
    test('All users from /api/users are validated for correct login behavior based on export_status', async ({ request }: { request: APIRequestContext }) => {
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
            `[US_PERSON] Expected login success for user "${user.name}" (username: "${user.username}"), but received success:${loginBody.success}. Message: "${loginBody.message}"`
          ).toBe(true);

          expect(
            loginBody.message,
            `[US_PERSON] Expected "Login Successful!" for user "${user.name}" (username: "${user.username}"), but got: "${loginBody.message}"`
          ).toContain('Login Successful!');

        } else if (user.export_status === 'NON_US_PERSON') {
          expect(
            loginBody.success,
            `[NON_US_PERSON] Expected login failure for user "${user.name}" (username: "${user.username}"), but received success:${loginBody.success}. Message: "${loginBody.message}"`
          ).toBe(false);

          expect(
            loginBody.message,
            `[NON_US_PERSON] Expected blocking message for user "${user.name}" (username: "${user.username}"), but got: "${loginBody.message}"`
          ).toContain('Only US Persons');

          expect(
            loginBody.message,
            `[NON_US_PERSON] Expected full error message for user "${user.name}" (username: "${user.username}"), but got: "${loginBody.message}"`
          ).toContain('Only U.S. Persons are permitted to login.');

          if (loginBody.exportStatus !== undefined) {
            expect(
              loginBody.exportStatus,
              `[NON_US_PERSON] Expected exportStatus to reflect NON_US_PERSON for user "${user.name}" (username: "${user.username}"), but got: "${loginBody.exportStatus}"`
            ).toBe('NON_US_PERSON');
          }

        } else {
          throw new Error(
            `Unexpected export_status "${user.export_status}" for user "${user.name}" (username: "${user.username}"). Only "US_PERSON" and "NON_US_PERSON" are supported.`
          );
        }
      }
    });
  });
});