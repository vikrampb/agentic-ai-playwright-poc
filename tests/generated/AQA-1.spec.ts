import { test, expect } from "@playwright/test";

const US_USER = {
  name: "Captain America",
  username: "captain.america",
  password: "Avengers2025!",
  exportStatus: "US_PERSON",
};

const NON_US_USER = {
  name: "Green Goblin",
  username: "green.goblin",
  password: "OsCorp2025!",
  exportStatus: "NON_US_PERSON",
};

const LOGIN_ENDPOINT = "/api/login";

test.describe("AQA-1 – US Person login", () => {
  test("US_PERSON user can log in successfully", async ({ request }) => {
    const response = await request.get(LOGIN_ENDPOINT, {
      params: {
        username: US_USER.username,
        password: US_USER.password,
      },
    });

    expect(
      response.status(),
      "Expected HTTP 200 for a valid US_PERSON login"
    ).toBe(200);

    const body = await response.json();

    expect(
      body.success,
      `Expected success=true for US_PERSON user "${US_USER.name}"`
    ).toBe(true);

    if (body.exportStatus !== undefined) {
      expect(
        body.exportStatus,
        "exportStatus in response should be US_PERSON"
      ).toBe(US_USER.exportStatus);
    }
  });
});

test.describe("AQA-1 – Non-US Person login", () => {
  test("NON_US_PERSON user is denied access with a graceful error message", async ({
    request,
  }) => {
    const response = await request.get(LOGIN_ENDPOINT, {
      params: {
        username: NON_US_USER.username,
        password: NON_US_USER.password,
      },
    });

    expect(
      response.status(),
      "Expected a non-2xx or 200 response indicating failure for NON_US_PERSON"
    ).toBeDefined();

    const body = await response.json();

    expect(
      body.success,
      `Expected success=false for NON_US_PERSON user "${NON_US_USER.name}"`
    ).toBe(false);

    expect(
      body.message,
      "Expected the error message to inform the user that only US Persons are allowed"
    ).toBe("Only US Persons are allowed to watch this demo.");
  });
});