import { describe, it, expect, vi, beforeEach } from "vitest";
import { InfernoApiClient, ApiClientError } from "./index.js";
import { ErrorCode } from "@project-inferno/contracts";

describe("InfernoApiClient Error Handling", () => {
  let client: InfernoApiClient;

  beforeEach(() => {
    client = new InfernoApiClient("http://localhost:3000");
    vi.restoreAllMocks();
  });

  it("handles successful health check response", async () => {
    const mockHealth = {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      database: "connected",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockHealth,
      })
    );

    const res = await client.checkHealth();
    expect(res.status).toBe("ok");
    expect(res.database).toBe("connected");
  });

  it("handles API error responses and throws ApiClientError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          code: ErrorCode.UNAUTHORIZED,
          message: "Invalid credentials.",
        }),
      })
    );

    await expect(
      client.login({ email: "wrong@test.com", passwordHash: "invalid" })
    ).rejects.toThrow(ApiClientError);

    try {
      await client.login({ email: "wrong@test.com", passwordHash: "invalid" });
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(err.message).toBe("Invalid credentials.");
    }
  });

  it("handles network error / connection refused gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("fetch failed"))
    );

    try {
      await client.checkHealth();
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(err.message).toContain("Network request failed");
      expect(err.message).toContain("fetch failed");
    }
  });
});
