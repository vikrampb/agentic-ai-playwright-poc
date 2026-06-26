import { test, expect } from "@playwright/test";

test.describe("AQA-1: Verify only US Users are able to log in to the application", () => {
  test.describe("US_PERSON user login", () => {
    test("Captain America (US_PERSON) should be able to log in successfully", async ({ request }) => {
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
      expect(body.message).not.toBe("Only US Persons are allowed to watch this demo.");
    });

    test("Captain America (US_PERSON) response should not contain a non-US person error message", async ({ request }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      const body = await response.json();

      expect(body.message).not.toContain("Only US Persons are allowed to watch this demo.");
    });

    test("Captain America (US_PERSON) response should include a success flag of true", async ({ request }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      const body = await response.json();

      expect(body).toHaveProperty("success", true);
    });
  });

  test.describe("NON_US_PERSON user login", () => {
    test("Green Goblin (NON_US_PERSON) should NOT be able to log in to the application", async ({ request }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();

      expect(body.success).toBe(false);
    });

    test("Green Goblin (NON_US_PERSON) should receive the correct error message", async ({ request }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const body = await response.json();

      expect(body.message).toBe("Only US Persons are allowed to watch this demo.");
    });

    test("Green Goblin (NON_US_PERSON) response should include a success flag of false", async ({ request }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const body = await response.json();

      expect(body).toHaveProperty("success", false);
    });

    test("Green Goblin (NON_US_PERSON) response exportStatus should reflect NON_US_PERSON", async ({ request }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const body = await response.json();

      if (body.exportStatus !== undefined) {
        expect(body.exportStatus).toBe("NON_US_PERSON");
      }

      expect(body.success).toBe(false);
      expect(body.message).toBe("Only US Persons are allowed to watch this demo.");
    });
  });

  test.describe("Contrast between US_PERSON and NON_US_PERSON login outcomes", () => {
    test("US_PERSON user succeeds while NON_US_PERSON user is denied access in the same test run", async ({ request }) => {
      const usPersonResponse = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      const usPersonBody = await usPersonResponse.json();

      expect(usPersonBody.success).toBe(true);
      expect(usPersonBody.message).not.toBe("Only US Persons are allowed to watch this demo.");

      const nonUsPersonResponse = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const nonUsPersonBody = await nonUsPersonResponse.json();

      expect(nonUsPersonBody.success).toBe(false);
      expect(nonUsPersonBody.message).toBe("Only US Persons are allowed to watch this demo.");
    });
  });
});