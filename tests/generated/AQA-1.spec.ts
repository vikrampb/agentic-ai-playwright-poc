import { test, expect } from "@playwright/test";

test.describe("AQA-1: Verify only US Users are able to log in to the application", () => {
  test.describe("US_PERSON user - Captain America should be able to log in successfully", () => {
    test("should return success=true when a US_PERSON user provides valid credentials", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.exportStatus).toBe("US_PERSON");
    });

    test("should return a success message when a US_PERSON user provides valid credentials", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();

      expect(body.message).toBeDefined();
      expect(typeof body.message).toBe("string");
      expect(body.message.length).toBeGreaterThan(0);
      expect(body.message).not.toBe(
        "Only US Persons are allowed to watch this demo."
      );
    });

    test("should return HTTP 200 status code for a US_PERSON user login", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      expect(response.status()).toBe(200);
    });
  });

  test.describe("NON_US_PERSON user - Green Goblin should NOT be able to log in", () => {
    test("should return success=false when a NON_US_PERSON user provides valid credentials", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const body = await response.json();

      expect(body.success).toBe(false);
    });

    test("should return the error message 'Only US Persons are allowed to watch this demo.' for a NON_US_PERSON user", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const body = await response.json();

      expect(body.message).toBeDefined();
      expect(body.message).toBe(
        "Only US Persons are allowed to watch this demo."
      );
    });

    test("should return the exportStatus of NON_US_PERSON for the Green Goblin user", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const body = await response.json();

      expect(body.exportStatus).toBeDefined();
      expect(body.exportStatus).toBe("NON_US_PERSON");
    });

    test("should return a non-2xx or an explicit failure indicator HTTP response for a NON_US_PERSON user login attempt", async ({
      request,
    }) => {
      const response = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const body = await response.json();

      expect(body.success).toBe(false);
      expect(response.ok()).toBeFalsy();
    });
  });

  test.describe("Contrast validation - US_PERSON vs NON_US_PERSON login outcomes differ", () => {
    test("should return opposite success values for US_PERSON and NON_US_PERSON users", async ({
      request,
    }) => {
      const usPersonResponse = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      const nonUsPersonResponse = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const usPersonBody = await usPersonResponse.json();
      const nonUsPersonBody = await nonUsPersonResponse.json();

      expect(usPersonBody.success).toBe(true);
      expect(nonUsPersonBody.success).toBe(false);
    });

    test("should return different messages for US_PERSON and NON_US_PERSON users", async ({
      request,
    }) => {
      const usPersonResponse = await request.get("/api/login", {
        params: {
          username: "captain.america",
          password: "Avengers2025!",
        },
      });

      const nonUsPersonResponse = await request.get("/api/login", {
        params: {
          username: "green.goblin",
          password: "OsCorp2025!",
        },
      });

      const usPersonBody = await usPersonResponse.json();
      const nonUsPersonBody = await nonUsPersonResponse.json();

      expect(usPersonBody.message).not.toBe(nonUsPersonBody.message);
      expect(nonUsPersonBody.message).toBe(
        "Only US Persons are allowed to watch this demo."
      );
    });
  });
});