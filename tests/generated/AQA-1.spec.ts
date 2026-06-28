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

  test('Login is successful if the export_status of the user attempting to login is US_PERSON', async ({ request }) => {
    const users = await getUsers(request);
    const usPersons = users.filter(user => user.export_status === "US_PERSON");
    
    for (const user of usPersons) {
      const response = await login(request, user.username, user.password);
      expect(response.success).toBe(true);
      expect(response.message).toContain("Login successful");
    }
  });

  test('Login fails if the export_status of the user attempting to login is NON_US_PERSON', async ({ request }) => {
    const users = await getUsers(request);
    const nonUsPersons = users.filter(user => user.export_status === "NON_US_PERSON");
    
    expect(nonUsPersons.length).toBeGreaterThan(0);
    
    for (const user of nonUsPersons) {
      const response = await login(request, user.username, user.password);
      expect(response.success).toBe(false);
      expect(response.message).toContain("Only US Persons are allowed to watch this demo.");
    }
  });
});
