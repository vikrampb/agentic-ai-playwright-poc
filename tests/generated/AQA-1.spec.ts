import { test, expect, APIRequestContext } from '@playwright/test';

interface User {
  id: string | number;
  name: string;
  export_status: string;
  username: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  exportStatus?: string;
}

function derivePassword(name: string): string {
  return name.split(' ').join('') + '2025!';
}

async function fetchAllUsers(request: APIRequestContext): Promise<User[]> {
  const response = await request.get('/api/users');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(Array.isArray(body.users)).toBeTruthy();
  return body.users as User[];
}

test.describe('AQA-1 – Verify only US Users are able to log in to the application', () => {
  let allUsers: User[] = [];

  test.beforeAll(async ({ request }) => {
    allUsers = await fetchAllUsers(request);
    expect(allUsers.length).toBeGreaterThan(0);
  });

  test.describe('Dynamic user login loop – US_PERSON users should succeed', () => {
    test('US_PERSON users can log in and receive a success message', async ({ request }) => {
      const usPersonUsers = allUsers.filter(u => u.export_status === 'US_PERSON');

      for (const user of usPersonUsers) {
        const password = derivePassword(user.name);

        const response = await request.get('/api/login', {
          params: {
            username: user.username,
            password,
          },
        });

        expect(response.ok()).toBeTruthy();
        const body: LoginResponse = await response.json();

        expect(
          body.success,
          `Expected login to succeed for US_PERSON user "${user.username}" but got success=${body.success}. Message: "${body.message}"`
        ).toBe(true);

        expect(
          body.message,
          `Expected a "Login Successful" message for US_PERSON user "${user.username}" but got: "${body.message}"`
        ).toContain('Login Successful');
      }
    });
  });

  test.describe('Dynamic user login loop – NON_US_PERSON users should be blocked', () => {
    test('NON_US_PERSON users cannot log in and receive the correct error message', async ({ request }) => {
      const nonUsPersonUsers = allUsers.filter(u => u.export_status === 'NON_US_PERSON');

      for (const user of nonUsPersonUsers) {
        const password = derivePassword(user.name);

        const response = await request.get('/api/login', {
          params: {
            username: user.username,
            password,
          },
        });

        expect(response.ok()).toBeTruthy();
        const body: LoginResponse = await response.json();

        expect(
          body.success,
          `Expected login to fail for NON_US_PERSON user "${user.username}" but got success=${body.success}. Message: "${body.message}"`
        ).toBe(false);

        expect(
          body.message,
          `Expected "Only US Persons" error message for NON_US_PERSON user "${user.username}" but got: "${body.message}"`
        ).toContain('Only US Persons');
      }
    });
  });

  test.describe('AC1 – Login success for US_PERSON users shows "Login Successful" message', () => {
    test('Each US_PERSON user receives a "Login Successful" message upon login', async ({ request }) => {
      const usPersonUsers = allUsers.filter(u => u.export_status === 'US_PERSON');

      expect(
        usPersonUsers.length,
        'No US_PERSON users found in /api/users – cannot validate AC1'
      ).toBeGreaterThan(0);

      for (const user of usPersonUsers) {
        const password = derivePassword(user.name);

        const response = await request.get('/api/login', {
          params: {
            username: user.username,
            password,
          },
        });

        expect(response.status()).toBe(200);
        const body: LoginResponse = await response.json();

        expect(
          body.success,
          `AC1 FAIL – US_PERSON user "${user.username}" should have success:true, got: ${body.success}`
        ).toBe(true);

        expect(
          body.message,
          `AC1 FAIL – US_PERSON user "${user.username}" should see "Login Successful", got: "${body.message}"`
        ).toContain('Login Successful');
      }
    });
  });

  test.describe('AC2 – Login failure for NON_US_PERSON users shows correct error message', () => {
    test('Each NON_US_PERSON user receives "Only US Persons are allowed to watch this demo." error on login', async ({ request }) => {
      const nonUsPersonUsers = allUsers.filter(u => u.export_status === 'NON_US_PERSON');

      expect(
        nonUsPersonUsers.length,
        'No NON_US_PERSON users found in /api/users – cannot validate AC2'
      ).toBeGreaterThan(0);

      for (const user of nonUsPersonUsers) {
        const password = derivePassword(user.name);

        const response = await request.get('/api/login', {
          params: {
            username: user.username,
            password,
          },
        });

        expect(response.status()).toBe(200);
        const body: LoginResponse = await response.json();

        expect(
          body.success,
          `AC2 FAIL – NON_US_PERSON user "${user.username}" should have success:false, got: ${body.success}`
        ).toBe(false);

        expect(
          body.message,
          `AC2 FAIL – NON_US_PERSON user "${user.username}" should see "Only US Persons are allowed to watch this demo.", got: "${body.message}"`
        ).toContain('Only US Persons are allowed to watch this demo.');

        if (body.exportStatus !== undefined) {
          expect(
            body.exportStatus,
            `AC2 FAIL – exportStatus for blocked user "${user.username}" should be NON_US_PERSON, got: "${body.exportStatus}"`
          ).toBe('NON_US_PERSON');
        }
      }
    });
  });

  test.describe('Edge cases and integrity checks', () => {
    test('All users returned by /api/users have a valid export_status value', async () => {
      const validStatuses = ['US_PERSON', 'NON_US_PERSON'];
      for (const user of allUsers) {
        expect(
          validStatuses,
          `User "${user.username}" has an unexpected export_status: "${user.export_status}"`
        ).toContain(user.export_status);
      }
    });

    test('All users returned by /api/users have non-empty username and name fields', async () => {
      for (const user of allUsers) {
        expect(
          user.username,
          `User with id "${user.id}" has an empty or missing username`
        ).toBeTruthy();

        expect(
          user.name,
          `User with id "${user.id}" has an empty or missing name`
        ).toBeTruthy();
      }
    });

    test('Login endpoint returns a message field for every user regardless of export_status', async ({ request }) => {
      for (const user of allUsers) {
        const password = derivePassword(user.name);

        const response = await request.get('/api/login', {
          params: {
            username: user.username,
            password,
          },
        });

        expect(response.ok()).toBeTruthy();
        const body: LoginResponse = await response.json();

        expect(
          typeof body.message,
          `User "${user.username}" login response is missing a message field`
        ).toBe('string');

        expect(
          body.message.length,
          `User "${user.username}" login response has an empty message field`
        ).toBeGreaterThan(0);

        expect(
          typeof body.success,
          `User "${user.username}" login response is missing a success field`
        ).toBe('boolean');
      }
    });
  });
});