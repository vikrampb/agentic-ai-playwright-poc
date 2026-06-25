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

      expect(response.status()).toBe(200);

      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body).toHaveProperty("message");
      expect(body.exportStatus).toBe("US_PERSON");
    });

    test("should not return the NON_US_PERSON error message for a US_PERSON user", async ({
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

      expect(body.message).not.toBe(
        "Only US Persons are allowed to watch this demo."
      );
    });
  });

  test.describe("NON_US_PERSON user - Green Goblin should NOT be able to log in", () => {
    test("should return success=false when a NON_US_PERSON user attempts to log in", async ({
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
    });

    test("should return the correct error message for a NON_US_PERSON user", async ({
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

      expect(body.message).toBe(
        "Only US Persons are allowed to watch this demo."
      );
    });

    test("should return exportStatus of NON_US_PERSON in the response for a blocked user", async ({
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

      expect(body.exportStatus).toBe("NON_US_PERSON");
    });
  });

  test.describe("Export status distinction between US and NON_US users", () => {
    test("should confirm US_PERSON and NON_US_PERSON users receive different success values", async ({
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

      expect(usPersonResponse.status()).toBe(200);
      expect(nonUsPersonResponse.status()).toBe(200);

      const usPersonBody = await usPersonResponse.json();
      const nonUsPersonBody = await nonUsPersonResponse.json();

      expect(usPersonBody.success).toBe(true);
      expect(nonUsPersonBody.success).toBe(false);
    });

    test("should confirm US_PERSON and NON_US_PERSON users receive different messages", async ({
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

      expect(usPersonResponse.status()).toBe(200);
      expect(nonUsPersonResponse.status()).toBe(200);

      const usPersonBody = await usPersonResponse.json();
      const nonUsPersonBody = await nonUsPersonResponse.json();

      expect(usPersonBody.message).not.toBe(nonUsPersonBody.message);
      expect(nonUsPersonBody.message).toBe(
        "Only US Persons are allowed to watch this demo."
      );
    });
  });
});