import { describe, it, expect } from "vitest";
import { ApiClient } from "./index.js";

describe("ApiClient", () => {
  it("should initialize with baseUrl and getToken function", () => {
    const client = new ApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "mock-token",
    });

    expect(client).toBeDefined();
    expect(typeof client.getWorlds).toBe("function");
    expect(typeof client.joinWorld).toBe("function");
    expect(typeof client.getMapChunks).toBe("function");
    expect(typeof client.getMapOverview).toBe("function");
    expect(typeof client.adminPreviewWorldGeneration).toBe("function");
  });
});
