import {
  BuildingTypeId,
  BuildingDefinitionDto,
  BuildingPrerequisite,
  ResourceCostMap,
  ResourceType,
  BaseBuildingDto,
  RaceId,
} from "@project-inferno/contracts";

export const CANONICAL_BUILDING_IDS: BuildingTypeId[] = [
  "B01",
  "B02",
  "B03",
  "B04",
  "B05",
  "B06",
  "B07",
  "B08",
  "B09",
  "B10",
  "B11",
  "B12",
  "B13",
  "B14",
];

export const BUILDING_DEFINITIONS: Record<BuildingTypeId, BuildingDefinitionDto> = {
  B01: {
    id: "B01",
    canonicalName: "Core Seat",
    maxLevel: 20,
    prerequisites: [],
    description: "Administration; unlocks tree; improves construction throughput.",
    raceNames: {
      HUMAN: "Town Hall",
      ANGEL: "Seat of Judgment",
      DEVIL: "Throne of Cinders",
      VAMPIRE: "Crimson Court",
      NECROMANCER: "Ossuary Throne",
      OLD_ONE: "Cyclopean Throne",
      WEAREBEARS: "High Chieftain Hall",
    },
  },
  B02: {
    id: "B02",
    canonicalName: "Material Producer",
    maxLevel: 20,
    prerequisites: [{ buildingType: "B01", level: 1 }],
    description: "Produces universal Building Material.",
    raceNames: {
      HUMAN: "Mason's Yard",
      ANGEL: "Mason's Yard",
      DEVIL: "Mason's Yard",
      VAMPIRE: "Mason's Yard",
      NECROMANCER: "Grave Quarry",
      OLD_ONE: "Cyclopean Quarry",
      WEAREBEARS: "Stoneworks",
    },
  },
  B03: {
    id: "B03",
    canonicalName: "Native-A Producer",
    maxLevel: 15,
    prerequisites: [{ buildingType: "B01", level: 3 }],
    description: "Produces Souls, Livestock or Remains based on race/tint.",
    raceNames: {
      HUMAN: "Common Market",
      ANGEL: "Soul Reliquary",
      DEVIL: "Soul Harvester",
      VAMPIRE: "Mortal Pens",
      NECROMANCER: "Corpse Yard",
      OLD_ONE: "Offering Pits",
      WEAREBEARS: "Tribute Pens",
    },
  },
  B04: {
    id: "B04",
    canonicalName: "Native-B Producer",
    maxLevel: 15,
    prerequisites: [
      { buildingType: "B01", level: 6 },
      { buildingType: "B03", level: 5 },
    ],
    description: "Produces the race-exclusive Native-B resource.",
    raceNames: {
      HUMAN: "Craftsman Guild",
      ANGEL: "Font of Grace",
      DEVIL: "Hellfire Well",
      VAMPIRE: "Blood Distillery",
      NECROMANCER: "Dust Crypt",
      OLD_ONE: "Ichor Well",
      WEAREBEARS: "Totem of Fury",
    },
  },
  B05: {
    id: "B05",
    canonicalName: "Population Building",
    maxLevel: 20,
    prerequisites: [{ buildingType: "B01", level: 2 }],
    description: "Raises maximum common population for economy and units.",
    raceNames: {
      HUMAN: "Residential District",
      ANGEL: "Pilgrim Quarter",
      DEVIL: "Thrall Quarter",
      VAMPIRE: "Mortal Quarter",
      NECROMANCER: "Cultist Quarter",
      OLD_ONE: "Servitor Quarter",
      WEAREBEARS: "Clan Settlement",
    },
  },
  B06: {
    id: "B06",
    canonicalName: "Unit Creator",
    maxLevel: 20,
    prerequisites: [
      { buildingType: "B01", level: 3 },
      { buildingType: "B02", level: 3 },
      { buildingType: "B05", level: 3 },
    ],
    description: "Creates baseline/common military units.",
    raceNames: {
      HUMAN: "Barracks",
      ANGEL: "Host Muster",
      DEVIL: "Legion Crucible",
      VAMPIRE: "Night Barracks",
      NECROMANCER: "Undead Assembler",
      OLD_ONE: "Cult Muster",
      WEAREBEARS: "War Lodge",
    },
  },
  B07: {
    id: "B07",
    canonicalName: "Technology Unlocker",
    maxLevel: 15,
    prerequisites: [
      { buildingType: "B01", level: 5 },
      { buildingType: "B03", level: 3 },
    ],
    description: "Unlocks configured technologies, units and tiers.",
    raceNames: {
      HUMAN: "Academy",
      ANGEL: "Scriptorium",
      DEVIL: "Archive of Pacts",
      VAMPIRE: "Forbidden Library",
      NECROMANCER: "Black Collegium",
      OLD_ONE: "Whispering Archive",
      WEAREBEARS: "Lore Lodge",
    },
  },
  B08: {
    id: "B08",
    canonicalName: "Advanced Unit Creator",
    maxLevel: 15,
    prerequisites: [
      { buildingType: "B01", level: 8 },
      { buildingType: "B06", level: 8 },
      { buildingType: "B07", level: 5 },
    ],
    description: "Creates advanced/elite fast/heavy units.",
    raceNames: {
      HUMAN: "High Arsenal",
      ANGEL: "Ascendant Arsenal",
      DEVIL: "Pit of Greater Forms",
      VAMPIRE: "Sanguine Menagerie",
      NECROMANCER: "Grand Reanimation Lab",
      OLD_ONE: "Transformation Pit",
      WEAREBEARS: "Great Beast Lodge",
    },
  },
  B09: {
    id: "B09",
    canonicalName: "Vault",
    maxLevel: 20,
    prerequisites: [{ buildingType: "B01", level: 2 }],
    description: "Raises resource storage capacity.",
    raceNames: {
      HUMAN: "Granary & Storehouse",
      ANGEL: "Reliquary Vault",
      DEVIL: "Infernal Treasury",
      VAMPIRE: "Bloodvault",
      NECROMANCER: "Burial Vault",
      OLD_ONE: "Sunken Vault",
      WEAREBEARS: "Hoard Hall",
    },
  },
  B10: {
    id: "B10",
    canonicalName: "Fortifications",
    maxLevel: 20,
    prerequisites: [{ buildingType: "B01", level: 4 }],
    description: "Improves local defense.",
    raceNames: {
      HUMAN: "Castle Walls",
      ANGEL: "Aegis Rampart",
      DEVIL: "Hellwall",
      VAMPIRE: "Nightwall",
      NECROMANCER: "Bone Rampart",
      OLD_ONE: "Cyclopean Wall",
      WEAREBEARS: "Palisade of Claws",
    },
  },
  B11: {
    id: "B11",
    canonicalName: "Siege Workshop",
    maxLevel: 15,
    prerequisites: [
      { buildingType: "B06", level: 6 },
      { buildingType: "B07", level: 4 },
    ],
    description: "Creates siege/support war machines.",
    raceNames: {
      HUMAN: "Siege Workshop",
      ANGEL: "Engine Choir",
      DEVIL: "Hellforge Workshop",
      VAMPIRE: "Dread Workshop",
      NECROMANCER: "Corpse Engine Yard",
      OLD_ONE: "Impossible Foundry",
      WEAREBEARS: "Breaker Yard",
    },
  },
  B12: {
    id: "B12",
    canonicalName: "Palace",
    maxLevel: 10,
    prerequisites: [
      { buildingType: "B01", level: 10 },
      { buildingType: "B07", level: 8 },
      { buildingType: "B13", level: 5 },
    ],
    description: "Creates/prepares colonization/capture unit or claim capability.",
    raceNames: {
      HUMAN: "Palace",
      ANGEL: "Mandate Spire",
      DEVIL: "Gate of Dominion",
      VAMPIRE: "Throne of Claim",
      NECROMANCER: "Soul Anchor",
      OLD_ONE: "Monolith of Dominion",
      WEAREBEARS: "Hall of Claim",
    },
  },
  B13: {
    id: "B13",
    canonicalName: "Market",
    maxLevel: 15,
    prerequisites: [
      { buildingType: "B01", level: 5 },
      { buildingType: "B09", level: 4 },
    ],
    description: "Direct player-to-player resource trading.",
    raceNames: {
      HUMAN: "Trade Market",
      ANGEL: "Concord Exchange",
      DEVIL: "Pact Exchange",
      VAMPIRE: "Midnight Bazaar",
      NECROMANCER: "Grave Exchange",
      OLD_ONE: "Cult Bazaar",
      WEAREBEARS: "Clan Market",
    },
  },
  B14: {
    id: "B14",
    canonicalName: "Black Market",
    maxLevel: 10,
    prerequisites: [
      { buildingType: "B13", level: 3 },
      { buildingType: "B07", level: 3 },
    ],
    description: "System Special to Special conversion.",
    raceNames: {
      HUMAN: "Black Market",
      ANGEL: "Veiled Exchange",
      DEVIL: "Crossroads of Sin",
      VAMPIRE: "Red Cellar",
      NECROMANCER: "Forbidden Broker",
      OLD_ONE: "Dream Market",
      WEAREBEARS: "Outcast Barter",
    },
  },
};

export function getBuildingDisplayName(buildingType: BuildingTypeId, raceId?: string | null): string {
  const def = BUILDING_DEFINITIONS[buildingType];
  if (!def) return buildingType;
  if (raceId && raceId in def.raceNames) {
    return def.raceNames[raceId as RaceId]!;
  }
  return def.canonicalName;
}

/**
 * Returns initial building set that every base always has.
 * Main hall (B01 Core Seat) starts at Level 1, and Material Producer (B02) starts at Level 1.
 */
export function getInitialBaseBuildings(): Record<BuildingTypeId, number> {
  const result = {} as Record<BuildingTypeId, number>;
  for (const bId of CANONICAL_BUILDING_IDS) {
    result[bId] = 0;
  }
  result["B01"] = 1;
  result["B02"] = 1;
  return result;
}

export function checkBuildingPrerequisites(
  buildingType: BuildingTypeId,
  currentBuildings: Record<BuildingTypeId, number>
): { isMet: boolean; missingPrerequisites: BuildingPrerequisite[] } {
  const def = BUILDING_DEFINITIONS[buildingType];
  if (!def) return { isMet: false, missingPrerequisites: [] };

  const missingPrerequisites: BuildingPrerequisite[] = [];
  for (const req of def.prerequisites) {
    const currentLv = currentBuildings[req.buildingType] || 0;
    if (currentLv < req.level) {
      missingPrerequisites.push(req);
    }
  }

  return {
    isMet: missingPrerequisites.length === 0,
    missingPrerequisites,
  };
}

/**
 * Maps race to native resources.
 */
export function getRaceNativeResources(raceId?: string | null): {
  nativeA: ResourceType | null;
  nativeB: ResourceType | null;
} {
  switch (raceId) {
    case "ANGEL":
      return { nativeA: "SOULS", nativeB: "DIVINE_GRACE" };
    case "DEVIL":
      return { nativeA: "SOULS", nativeB: "HELLFIRE_ESSENCE" };
    case "WEREBEAR":
    case "WEAREBEARS":
      return { nativeA: "LIVESTOCK", nativeB: "PRIMAL_FURY" };
    case "VAMPIRE":
      return { nativeA: "LIVESTOCK", nativeB: "BLOOD_ESSENCE" };
    case "NECROMANCER":
      return { nativeA: "REMAINS", nativeB: "GRAVE_DUST" };
    case "OLD_ONE":
      return { nativeA: "REMAINS", nativeB: "VOID_ICHOR" };
    case "HUMAN":
    default:
      return { nativeA: "SOULS", nativeB: null };
  }
}

/**
 * Calculates resource upgrade cost for target building level.
 */
export function calculateBuildingUpgradeCost(
  buildingType: BuildingTypeId,
  targetLevel: number,
  raceId?: string | null
): ResourceCostMap {
  if (targetLevel <= 0) return {};

  const cost: ResourceCostMap = {};
  const { nativeA, nativeB } = getRaceNativeResources(raceId);

  // Building Material is always main volume
  cost["BUILDING_MATERIAL"] = Math.round(100 * Math.pow(1.22, targetLevel - 1));

  // Native-A starts appearing at level 5
  if (targetLevel >= 5 && nativeA) {
    cost[nativeA] = Math.round(20 * Math.pow(1.25, targetLevel - 5));
  }

  // Native-B starts appearing at level 10
  if (targetLevel >= 10 && nativeB) {
    cost[nativeB] = Math.round(20 * Math.pow(1.25, targetLevel - 10));
  }

  return cost;
}

/**
 * Calculates upgrade duration in seconds taking Core Seat level into account.
 */
export function calculateBuildDurationSeconds(targetLevel: number, coreSeatLevel: number): number {
  const baseSeconds = targetLevel * 30;
  const cSeatLv = Math.max(1, coreSeatLevel);
  // Each Core Seat level reduces build duration by speeding up processing
  const speedMultiplier = 1 + 0.1 * (cSeatLv - 1);
  return Math.max(5, Math.round(baseSeconds / speedMultiplier));
}

/**
 * Builds array of BaseBuildingDto for a base.
 */
export function buildBaseBuildingsDtos(
  currentBuildings: Record<BuildingTypeId, number>,
  raceId?: string | null
): BaseBuildingDto[] {
  const coreSeatLv = currentBuildings["B01"] || 1;

  return CANONICAL_BUILDING_IDS.map((bId) => {
    const def = BUILDING_DEFINITIONS[bId];
    const level = currentBuildings[bId] || 0;
    const { isMet } = checkBuildingPrerequisites(bId, currentBuildings);
    const isUpgradeable = level < def.maxLevel && isMet;

    const nextLevel = level + 1;
    const nextLevelCost = isUpgradeable
      ? calculateBuildingUpgradeCost(bId, nextLevel, raceId)
      : undefined;

    const buildDurationSeconds = isUpgradeable
      ? calculateBuildDurationSeconds(nextLevel, coreSeatLv)
      : undefined;

    return {
      buildingType: bId,
      level,
      displayName: getBuildingDisplayName(bId, raceId),
      canonicalName: def.canonicalName,
      maxLevel: def.maxLevel,
      prerequisites: def.prerequisites,
      isUpgradeable,
      nextLevelCost,
      buildDurationSeconds,
    };
  });
}
