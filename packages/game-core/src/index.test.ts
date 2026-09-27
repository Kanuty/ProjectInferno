import { describe, it, expect } from "vitest";
import { calculateResources, calculateArrivalAt } from "../src/index.js";

describe("game-core domain calculations", () => {
  it("calculates resource accumulation deterministically based on reference time", () => {
    const referenceAt = new Date("2025-01-01T00:00:00Z");
    const effectiveTime = new Date("2025-01-01T01:00:00Z"); // 3600 seconds later

    const total = calculateResources({
      amountAtReference: 100,
      productionRate: 2, // 2 units per sec -> 7200 produced
      referenceAt,
      effectiveTime,
      capacity: 10000,
    });

    expect(total).toBe(7300);
  });

  it("caps resource accumulation at capacity", () => {
    const referenceAt = new Date("2025-01-01T00:00:00Z");
    const effectiveTime = new Date("2025-01-01T10:00:00Z"); // 36,000 seconds later

    const total = calculateResources({
      amountAtReference: 100,
      productionRate: 5,
      referenceAt,
      effectiveTime,
      capacity: 500,
    });

    expect(total).toBe(500);
  });

  it("calculates movement arrival time accurately", () => {
    const startTime = new Date("2025-01-01T00:00:00Z");
    const arrival = calculateArrivalAt({
      startX: 0,
      startY: 0,
      targetX: 3,
      targetY: 4, // distance = 5
      speed: 1,   // 5 seconds travel time
      startTime,
    });

    expect(arrival.toISOString()).toBe("2025-01-01T00:00:05.000Z");
  });
});
