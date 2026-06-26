import { test, expect } from "@playwright/test";

test.describe("AQA-1: Verify only US Users are able to log in to the application", () => {
  test.describe("Scenario 1: Validate only US users can view the demo", () => {
    test("US Person (Captain America) should be allowed to log in successfully", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.exportStatus).toBe("US_PERSON");
    });

    test("NON-US Person (Green Goblin) should NOT be allowed to log in", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();

      expect(body.success).toBe(false);
      expect(body.exportStatus).toBe("NON_US_PERSON");
    });
  });

  test.describe("Scenario 2: Non-US Person receives the correct error message", () => {
    test("US Person (Captain America) should NOT receive a Non-US Person error message", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.message).not.toBe(
        "Only US Persons are allowed to watch this demo."
      );
    });

    test("NON-US Person (Green Goblin) should receive error message 'Only US Persons are allowed to watch this demo.'", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();

      expect(body.success).toBe(false);
      expect(body.message).toBe(
        "Only US Persons are allowed to watch this demo."
      );
    });
  });
});