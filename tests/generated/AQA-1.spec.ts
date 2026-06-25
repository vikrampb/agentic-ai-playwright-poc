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

test.describe("AQA-1 | US Person Login", () => {
  test("US_PERSON user (Captain America) should be able to log in successfully", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(US_USER.username)}&password=${encodeURIComponent(US_USER.password)}`
    );

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body).toHaveProperty("success", true);
    expect(body.success).toBe(true);

    if (body.exportStatus !== undefined) {
      expect(body.exportStatus).toBe(US_USER.exportStatus);
    }

    expect(body.message).not.toBe(
      "Only US Persons are allowed to watch this demo."
    );
  });
});

test.describe("AQA-1 | NON-US Person Login", () => {
  test("NON_US_PERSON user (Green Goblin) should NOT be able to log in and should receive an error message", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/login?username=${encodeURIComponent(NON_US_USER.username)}&password=${encodeURIComponent(NON_US_USER.password)}`
    );

    const body = await response.json();

    expect(body).toHaveProperty("success", false);
    expect(body.success).toBe(false);

    expect(body).toHaveProperty("message");
    expect(body.message).toBe("Only US Persons are allowed to watch this demo.");

    if (body.exportStatus !== undefined) {
      expect(body.exportStatus).toBe(NON_US_USER.exportStatus);
    }
  });
});