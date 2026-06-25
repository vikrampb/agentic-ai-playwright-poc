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

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.message).toBeTruthy();

    if (body.exportStatus !== undefined) {
      expect(body.exportStatus).toBe(US_USER.exportStatus);
    }
  });

  test("US_PERSON user response should not contain a NON_US_PERSON restriction message", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        US_USER.username
      )}&password=${encodeURIComponent(US_USER.password)}`
    );

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.message).not.toBe(
      "Only US Persons are allowed to watch this demo."
    );
  });
});

test.describe("AQA-1 – Non-US Person login", () => {
  test("NON_US_PERSON user should not be able to log in", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        NON_US_USER.username
      )}&password=${encodeURIComponent(NON_US_USER.password)}`
    );

    const body = await response.json();

    expect(body.success).toBe(false);
  });

  test("NON_US_PERSON user should receive the correct error message", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        NON_US_USER.username
      )}&password=${encodeURIComponent(NON_US_USER.password)}`
    );

    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "Only US Persons are allowed to watch this demo."
    );
  });

  test("NON_US_PERSON user response should gracefully handle the restriction without a server error", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        NON_US_USER.username
      )}&password=${encodeURIComponent(NON_US_USER.password)}`
    );

    expect(response.status()).toBeLessThan(500);

    const body = await response.json();

    expect(body.success).toBe(false);
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });
});