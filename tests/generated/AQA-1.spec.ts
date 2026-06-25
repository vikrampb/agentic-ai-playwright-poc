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

test.describe("AQA-1 – US Person login", () => {
  test("US_PERSON user should be able to log in successfully", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        US_USER.username
      )}&password=${encodeURIComponent(US_USER.password)}`
    );

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

test.describe("AQA-1 – NON_US Person login", () => {
  test("NON_US_PERSON user should NOT be able to log in and should receive a graceful error message", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        NON_US_USER.username
      )}&password=${encodeURIComponent(NON_US_USER.password)}`
    );

    expect(
      [200, 401, 403],
      `Expected an HTTP status indicating denial for NON_US_PERSON user "${NON_US_USER.name}", but got ${response.status()}`
    ).toContain(response.status());

    const body = await response.json();

    expect(
      body.success,
      `Expected success=false for NON_US_PERSON user "${NON_US_USER.name}"`
    ).toBe(false);

    expect(
      body.message,
      "Expected a graceful error message for NON_US_PERSON users"
    ).toBe("Only US Persons are allowed to watch this demo.");
  });
});