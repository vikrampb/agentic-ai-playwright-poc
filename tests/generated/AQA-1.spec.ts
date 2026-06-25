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

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body).toHaveProperty("success", true);
    expect(body.success).toBe(true);

    if (body.exportStatus !== undefined) {
      expect(body.exportStatus).toBe(US_USER.exportStatus);
    }
  });

  test("US_PERSON response should NOT contain a blocking error message", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        US_USER.username
      )}&password=${encodeURIComponent(US_USER.password)}`
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).not.toBe(
      "Only US Persons are allowed to watch this demo."
    );
  });
});

test.describe("AQA-1 – Non-US Person login", () => {
  test("NON_US_PERSON user should NOT be able to log in", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        NON_US_USER.username
      )}&password=${encodeURIComponent(NON_US_USER.password)}`
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body).toHaveProperty("success", false);
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

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body).toHaveProperty("message");
    expect(body.message).toBe(
      "Only US Persons are allowed to watch this demo."
    );
  });

  test("NON_US_PERSON response should have a graceful and non-empty error message", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(
        NON_US_USER.username
      )}&password=${encodeURIComponent(NON_US_USER.password)}`
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(typeof body.message).toBe("string");
    expect(body.message.trim().length).toBeGreaterThan(0);
  });
});