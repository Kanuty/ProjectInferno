import { describe, it, expect } from "vitest";
import {
  calculateResources,
  calculateArrivalAt,
  HexDistanceService,
  createSeededRandom,
  getHexesInRadius,
  generateWorldMapPreview,
  selectPlayerSpawnHex,
  selectPeriodicNeutralSpawnHex,
  getRaceDefinition,
  isValidPlayableRace,
  getNeutralRaceId,
  SELECTABLE_RACES,
  RACE_DEFINITIONS,
  NEUTRAL_RACE_ID,
  DEFAULT_WORLD_MAP_CONFIG,
} from "./index.js";

describe("Game Core Logic", () => {
  describe("Resource Calculations", () => {
    it("should calculate resources linearly based on elapsed time", () => {
      const refTime = new Date("2025-01-01T00:00:00Z");
      const effTime = new Date("2025-01-01T00:01:40Z"); // 100 seconds later

      const result = calculateResources({
        amountAtReference: 100,
        productionRate: 2, // 2 per second
        referenceAt: refTime,
        effectiveTime: effTime,
        capacity: 1000,
      });

      expect(result).toBe(300); // 100 + 100*2
    });

    it("should cap resource calculation at capacity", () => {
      const refTime = new Date("2025-01-01T00:00:00Z");
      const effTime = new Date("2025-01-01T01:00:00Z"); // 3600 seconds later

      const result = calculateResources({
        amountAtReference: 100,
        productionRate: 10,
        referenceAt: refTime,
        effectiveTime: effTime,
        capacity: 5000,
      });

      expect(result).toBe(5000);
    });
  });

  describe("HexDistanceService", () => {
    it("should calculate correct axial hex distances", () => {
      expect(HexDistanceService.distance(0, 0, 0, 0)).toBe(0);
      expect(HexDistanceService.distance(0, 0, 1, 0)).toBe(1);
      expect(HexDistanceService.distance(0, 0, 0, 1)).toBe(1);
      expect(HexDistanceService.distance(0, 0, 1, -1)).toBe(1);
      expect(HexDistanceService.distance(-2, 2, 2, -2)).toBe(4);
    });

    it("should calculate army travel time using slowest unit and world speed", () => {
      // Distance 3, 10 min/hex, worldSpeed 1.0 => 3 * 10 * 60 = 1800s
      const seconds = HexDistanceService.calculateArmyTravelSeconds(3, 10, 1.0);
      expect(seconds).toBe(1800);

      // Distance 3, 10 min/hex, worldSpeed 2.0 => 900s
      const seconds2x = HexDistanceService.calculateArmyTravelSeconds(3, 10, 2.0);
      expect(seconds2x).toBe(900);
    });

    it("should calculate market travel time using merchant speed", () => {
      // Distance 4, 5 min/hex, worldSpeed 1.0 => 4 * 5 * 60 = 1200s
      const seconds = HexDistanceService.calculateMarketTravelSeconds(4, 5, 1.0);
      expect(seconds).toBe(1200);
    });
  });

  describe("Hex World Grid & Spawning", () => {
    it("should generate exact number of hexes for radius R", () => {
      const radius = 10;
      const hexes = getHexesInRadius(radius);
      const expectedCount = 3 * radius * (radius + 1) + 1; // 331
      expect(hexes.length).toBe(expectedCount);
    });

    it("should generate world preview deterministically with seed", () => {
      const preview1 = generateWorldMapPreview({ radius: 10, seed: "test-seed-1" });
      const preview2 = generateWorldMapPreview({ radius: 10, seed: "test-seed-1" });

      expect(preview1.totalHexes).toBe(331);
      expect(preview1.initialNeutralsCount).toBe(preview2.initialNeutralsCount);
      expect(preview1.initialNeutrals).toEqual(preview2.initialNeutrals);
      expect(preview1.feasibilityScore).toBeGreaterThanOrEqual(0);
    });

    it("should spawn player base and reserve 2 guaranteed nearby neutrals", () => {
      const config = { ...DEFAULT_WORLD_MAP_CONFIG, radius: 10 };
      const occupied = new Set<string>();
      const playerHexes: any[] = [];

      const result = selectPlayerSpawnHex(config, occupied, playerHexes);
      expect(result).not.toBeNull();
      expect(result?.guaranteedNeutrals.length).toBe(2);

      // Verify distance of guaranteed neutrals <= 4
      for (const neutral of result!.guaranteedNeutrals) {
        const dist = HexDistanceService.distance(
          result!.playerHex.q,
          result!.playerHex.r,
          neutral.q,
          neutral.r
        );
        expect(dist).toBeLessThanOrEqual(4);
      }
    });

    it("should select periodic neutral spawn hex within radius bounds", () => {
      const config = { ...DEFAULT_WORLD_MAP_CONFIG, radius: 10, periodicSpawnRadiusMin: 2, periodicSpawnRadiusMax: 4 };
      const playerBases = [{ q: 0, r: 0 }];
      const occupied = new Set<string>(["0,0"]);

      const periodicHex = selectPeriodicNeutralSpawnHex(config, playerBases, occupied, () => 0.5);
      expect(periodicHex).not.toBeNull();

      const dist = HexDistanceService.distance(0, 0, periodicHex!.q, periodicHex!.r);
      expect(dist).toBeGreaterThanOrEqual(2);
      expect(dist).toBeLessThanOrEqual(4);
    });
  });

  describe("Races System & Validation", () => {
    it("should define WEAREBEARS as the neutral race ID", () => {
      expect(getNeutralRaceId()).toBe("WEAREBEARS");
      expect(NEUTRAL_RACE_ID).toBe("WEAREBEARS");
    });

    it("should allow playable races and disallow WEAREBEARS or invalid IDs for selection", () => {
      expect(isValidPlayableRace("HUMAN")).toBe(true);
      expect(isValidPlayableRace("ANGEL")).toBe(true);
      expect(isValidPlayableRace("DEVIL")).toBe(true);
      expect(isValidPlayableRace("VAMPIRE")).toBe(true);
      expect(isValidPlayableRace("NECROMANCER")).toBe(true);
      expect(isValidPlayableRace("OLD_ONE")).toBe(true);

      // WEAREBEARS must NOT be selectable
      expect(isValidPlayableRace("WEAREBEARS")).toBe(false);
      expect(SELECTABLE_RACES).not.toContain("WEAREBEARS");

      expect(isValidPlayableRace("UNKNOWN")).toBe(false);
      expect(isValidPlayableRace(null)).toBe(false);
    });

    it("should retrieve race definitions with presentation profiles, ecology, unit & building names", () => {
      const humanDef = getRaceDefinition("HUMAN");
      expect(humanDef.name).toBe("Human Kingdoms");
      expect(humanDef.buildingNames.town_hall).toBe("Town Hall");
      expect(humanDef.unitNames.u1).toBe("Conscript Levy");

      const bearDef = getRaceDefinition("WEAREBEARS");
      expect(bearDef.name).toBe("Wearebears Clan");
      expect(bearDef.isSelectable).toBe(false);
      expect(bearDef.buildingNames.town_hall).toBe("Bear Dens");
      expect(bearDef.unitNames.u1).toBe("Bearhide Warrior");

      // Fallback for null / unknown
      const fallback = getRaceDefinition("UNKNOWN_RACE");
      expect(fallback.id).toBe("HUMAN");
    });
  });
});
