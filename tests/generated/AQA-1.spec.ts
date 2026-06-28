import { test, expect, APIRequestContext } from '@playwright/test';

interface User {
  id:            number;
  name:          string;
  export_status: 'US_PERSON' | 'NON_US_PERSON';
  username:      string;
  password:      string;
}

interface LoginResponse {
  success:       boolean;
  message:       string;
  exportStatus?: string;
}

async function getUsers(request: APIRequestContext): Promise<User[]> {
  const res  = await request.get('/api/users');
  const body = await res.json();
  return body.users as User[];
}

async function login(
  request:  APIRequestContext,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const res = await request.get('/api/login', { params: { username, password } });
  return res.json();
}

test.describe('AQA-1 – Verify only US Users are able to log in to the application', () => {

  test('Validate only users with an export_status of US_PERSON are allowed to watch the demo.', async ({ request }) => {
    const users = await getUsers(request);
    
    for (const user of users) {
      const response = await login(request, user.username, user.password);
    
      if (user.export_status === "US_PERSON") {
        expect(response.success).toBe(true);
        expect(response.message).toContain("Login successful");
      } else {
        expect(response.success).toBe(false);
        expect(response.message).toContain("Only US Persons are allowed to watch this demo.");
      }
    }
  });
});
