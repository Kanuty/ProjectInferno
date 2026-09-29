import { describe, it, expect, vi, beforeEach } from "vitest";
import { InfernoApiClient, ApiClientError } from "./index.js";
import { ErrorCode } from "@project-inferno/contracts";

describe("InfernoApiClient Error Handling", () => {
  let client: InfernoApiClient;

  beforeEach(() => {
    client = new InfernoApiClient("http://localhost:3000");
    vi.restoreAllMocks();
  });

  it("checks username availability via API client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ available: true, message: "Username is available." }),
      })
    );

    const res = await client.checkUsername("lord_inferno");
    expect(res.available).toBe(true);
  });

  it("activates account using confirmation token", async () => {
    const mockAuthResponse = {
      token: "mock-jwt-token-123",
      user: {
        id: "123",
        username: "inferno_warrior",
        email: "warrior@inferno.com",
        status: "active",
        createdAt: new Date().toISOString(),
      },
      message: "Account successfully activated!",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAuthResponse,
      })
    );

    const res = await client.activateAccount("valid-token-123");
    expect(res.token).toBe("mock-jwt-token-123");
    expect(res.user.status).toBe("active");
  });

  it("handles registration call with terms accepted", async () => {
    const mockAuthResponse = {
      token: "",
      user: {
        id: "123",
        username: "inferno_warrior",
        email: "warrior@inferno.com",
        status: "pending_activation",
        createdAt: new Date().toISOString(),
      },
      message: "Account created!",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAuthResponse,
      })
    );

    const res = await client.register({
      username: "inferno_warrior",
      email: "warrior@inferno.com",
      passwordHash: "securePass123",
      termsAccepted: true,
    });

    expect(res.user.username).toBe("inferno_warrior");
    expect(res.user.status).toBe("pending_activation");
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
      client.login({ login: "wrong@test.com", passwordHash: "invalidPass123" })
    ).rejects.toThrow(ApiClientError);

    try {
      await client.login({ login: "wrong@test.com", passwordHash: "invalidPass123" });
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
