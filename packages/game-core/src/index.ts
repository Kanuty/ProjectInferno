import {
  HexCoordinates,
  WorldMapConfig,
  CosmeticFeatureDto,
  CosmeticTerrainType,
  RaceDefinition,
  RaceId,
  PlayableRaceId,
  NeutralRaceId,
} from "@project-inferno/contracts";

export const NEUTRAL_RACE_ID: NeutralRaceId = "WEAREBEARS";

export const SELECTABLE_RACES: PlayableRaceId[] = [
  "HUMAN",
  "ANGEL",
  "DEVIL",
  "VAMPIRE",
  "NECROMANCER",
  "OLD_ONE",
];

export const RACE_DEFINITIONS: Record<RaceId, RaceDefinition> = {
  HUMAN: {
    id: "HUMAN",
    name: "Human Kingdoms",
    description: "Versatile human kingdom with traditional fortifications and disciplined armies.",
    icon: "🏰",
    badgeEmoji: "🛡️",
    isSelectable: true,
    ecology: {
      terrainType: "Temperate Plains",
      description: "Fertile green plains with temperate fields, wooden palisades, and stone keeps.",
      primaryColor: "#3b82f6",
    },
    buildingNames: {
      town_hall: "Town Hall",
      barracks: "Barracks",
      granary: "Granary & Storehouse",
      market: "Trade Market",
      tower: "Watchtower",
    },
    unitNames: {
      u1: "Conscript Levy",
      u2: "Footman Guard",
      u3: "Longbowman",
      u4: "Knight",
      u5: "Royal Sentinel",
    },
  },
  ANGEL: {
    id: "ANGEL",
    name: "Seraphic Host",
    description: "Radiant divine champions who build sanctuaries atop glowing high grounds.",
    icon: "👼",
    badgeEmoji: "✨",
    isSelectable: true,
    ecology: {
      terrainType: "Vibrant Sanctuary",
      description: "Vibrant green sanctuaries bathed in divine light and golden monuments.",
      primaryColor: "#eab308",
    },
    buildingNames: {
      town_hall: "Sanctum Cathedral",
      barracks: "Heavenly Citadel",
      granary: "Solar Silo",
      market: "Celestial Exchange",
      tower: "Luminaria Spire",
    },
    unitNames: {
      u1: "Light Initiate",
      u2: "Sanctified Warden",
      u3: "Celestial Marksman",
      u4: "Solar Paladin",
      u5: "Archangel Sentinel",
    },
  },
  DEVIL: {
    id: "DEVIL",
    name: "Infernal Legion",
    description: "Fiends of molten volcanic lands forging obsidian iron and hellfire.",
    icon: "👿",
    badgeEmoji: "🔥",
    isSelectable: true,
    ecology: {
      terrainType: "Scorched Lava Fields",
      description: "Scorched obsidian soil, glowing lava cracks, and fiery spires.",
      primaryColor: "#ef4444",
    },
    buildingNames: {
      town_hall: "Fiend Fortress",
      barracks: "Obsidian Pit",
      granary: "Magma Granary",
      market: "Hellfire Market",
      tower: "Brimstone Tower",
    },
    unitNames: {
      u1: "Fiend Initiate",
      u2: "Hellfire Enforcer",
      u3: "Ash Marksman",
      u4: "Dread Knight",
      u5: "Infernal Behemoth",
    },
  },
  VAMPIRE: {
    id: "VAMPIRE",
    name: "Blood Court",
    description: "Aristocratic nocturnal courts of gothic manor estates and blood magic.",
    icon: "🧛",
    badgeEmoji: "🩸",
    isSelectable: true,
    ecology: {
      terrainType: "Gothic Night Grass",
      description: "Dark purple-black nocturnal grass, mist-veiled gothic towers, and blood monuments.",
      primaryColor: "#a855f7",
    },
    buildingNames: {
      town_hall: "Gothic Manor",
      barracks: "Blood Citadel",
      granary: "Blood Vault",
      market: "Night Exchange",
      tower: "Bat Spire",
    },
    unitNames: {
      u1: "Night Thrall",
      u2: "Blood Guard",
      u3: "Shadow Archer",
      u4: "Nightrider Knight",
      u5: "Dread Countess",
    },
  },
  NECROMANCER: {
    id: "NECROMANCER",
    name: "Undead Dominion",
    description: "Masters of the necrotic arts raising bone structures and blighted waste.",
    icon: "💀",
    badgeEmoji: "☠️",
    isSelectable: true,
    ecology: {
      terrainType: "Blighted Green Wasteland",
      description: "Blighted toxic waste, glowing green runes, and ossuary crypts.",
      primaryColor: "#22c55e",
    },
    buildingNames: {
      town_hall: "Necropolis",
      barracks: "Spire of the Dead",
      granary: "Crypt Vault",
      market: "Shadow Market",
      tower: "Ossuary Spire",
    },
    unitNames: {
      u1: "Skeleton Levy",
      u2: "Grave Warden",
      u3: "Bone Crossbow",
      u4: "Death Knight",
      u5: "Dread Lich",
    },
  },
  OLD_ONE: {
    id: "OLD_ONE",
    name: "Eldritch Abyss",
    description: "Ancient mysterious cults summoning void horrors from deep cosmos.",
    icon: "🐙",
    badgeEmoji: "👁️",
    isSelectable: true,
    ecology: {
      terrainType: "Void Abyss & Tentacles",
      description: "Deep violet abyss ground surrounded by writhing eldritch tentacles.",
      primaryColor: "#6366f1",
    },
    buildingNames: {
      town_hall: "Eldritch Citadel",
      barracks: "Temple of the Void",
      granary: "Miasma Vault",
      market: "Abyssal Exchange",
      tower: "Void Eye Spire",
    },
    unitNames: {
      u1: "Cultist Initiate",
      u2: "Abyssal Warden",
      u3: "Void Whisperer",
      u4: "Eldritch Terror",
      u5: "Leviathan Guard",
    },
  },
  WEAREBEARS: {
    id: "WEAREBEARS",
    name: "Wearebears Clan",
    description: "Fierce independent bear tribe inhabiting snowy swamps and wilderness settlements.",
    icon: "🐻",
    badgeEmoji: "🐾",
    isSelectable: false,
    ecology: {
      terrainType: "Snowy Swamp & Bear Den",
      description: "Snowy swampland with rugged bearhide tents, wooden totems, and claw marks.",
      primaryColor: "#eab308",
    },
    buildingNames: {
      town_hall: "Bear Dens",
      barracks: "Tribal Training Grounds",
      granary: "Wilderness Stash",
      market: "Claw Trading Post",
      tower: "Greatfang Watch",
    },
    unitNames: {
      u1: "Bearhide Warrior",
      u2: "Claw Guardian",
      u3: "Swamp Berserker",
      u4: "Greatfang Chieftain",
      u5: "Ursa Elder",
    },
  },
};

export function getRaceDefinition(id?: string | null): RaceDefinition {
  if (!id || !(id in RACE_DEFINITIONS)) {
    return RACE_DEFINITIONS.HUMAN;
  }
  return RACE_DEFINITIONS[id as RaceId];
}

export function isValidPlayableRace(id?: string | null): boolean {
  if (!id) return false;
  return SELECTABLE_RACES.includes(id as PlayableRaceId);
}

export function getNeutralRaceId(): NeutralRaceId {
  return NEUTRAL_RACE_ID;
}

export * from "./buildings.js";
export * from "./resources.js";

/**
 * Pure resource calculation logic.
 */
export interface ResourceCalculationInput {
  amountAtReference: number;
  productionRate: number; // units per second
  referenceAt: Date;
  effectiveTime: Date;
  capacity: number;
}

export function calculateResources(input: ResourceCalculationInput): number {
  const { amountAtReference, productionRate, referenceAt, effectiveTime, capacity } = input;
  const elapsedSeconds = Math.max(0, (effectiveTime.getTime() - referenceAt.getTime()) / 1000);
  const produced = elapsedSeconds * productionRate;
  const currentTotal = amountAtReference + produced;
  return Math.min(capacity, Math.max(0, currentTotal));
}

export interface MovementEtaInput {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  startTime: Date;
}

export function calculateArrivalAt(input: MovementEtaInput): Date {
  const { startX, startY, targetX, targetY, speed, startTime } = input;
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const durationSeconds = speed > 0 ? distance / speed : 0;
  return new Date(startTime.getTime() + durationSeconds * 1000);
}

/**
 * Seeded PRNG (Mulberry32).
 */
export function createSeededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return function () {
    let t = (h += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Single source of truth for Hex axial distance and movement formulas.
 */
export class HexDistanceService {
  public static distance(q1: number, r1: number, q2: number, r2: number): number {
    return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - (q2 + r2))) / 2;
  }

  public static calculateArmyTravelSeconds(
    distance: number,
    slowestUnitMinutesPerHex: number,
    worldSpeed: number,
    explicitMovementModifiers: number = 1.0
  ): number {
    if (distance <= 0) return 0;
    const speedCoeff = worldSpeed > 0 ? worldSpeed : 1.0;
    return (distance * slowestUnitMinutesPerHex * 60 / speedCoeff) * explicitMovementModifiers;
  }

  public static calculateMarketTravelSeconds(
    distance: number,
    merchantMinutesPerHex: number,
    worldSpeed: number,
    marketModifiers: number = 1.0
  ): number {
    if (distance <= 0) return 0;
    const speedCoeff = worldSpeed > 0 ? worldSpeed : 1.0;
    return (distance * merchantMinutesPerHex * 60 / speedCoeff) * marketModifiers;
  }
}

/**
 * Default Map and Spawning Configuration
 */
export const DEFAULT_WORLD_MAP_CONFIG: WorldMapConfig = {
  radius: 15,
  seed: "inferno-default-seed",
  maxPlayers: 100,
  worldSpeed: 1.0,
  armyMinutesPerHex: 10,
  merchantMinutesPerHex: 5,
  minPlayerSeparation: 3,
  guaranteedNeutralsCount: 2,
  guaranteedNeutralsMaxDistance: 4,
  initialNeutralDensity: 0.04,
  periodicSpawnIntervalDays: 1,
  periodicSpawnCutoffDays: 30,
  periodicSpawnRadiusMin: 2,
  periodicSpawnRadiusMax: 6,
};

export function isWithinRadius(q: number, r: number, radius: number): boolean {
  return HexDistanceService.distance(0, 0, q, r) <= radius;
}

export function getHexesInRadius(radius: number): HexCoordinates[] {
  const validRadius = Math.max(1, Math.floor(radius));
  const hexes: HexCoordinates[] = [];
  for (let q = -validRadius; q <= validRadius; q++) {
    const r1 = Math.max(-validRadius, -q - validRadius);
    const r2 = Math.min(validRadius, -q + validRadius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
}

export const HEX_DIRECTIONS: HexCoordinates[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function getNeighbors(q: number, r: number): HexCoordinates[] {
  return HEX_DIRECTIONS.map((dir) => ({ q: q + dir.q, r: r + dir.r }));
}

export interface WorldMapPreviewResult {
  mapConfig: WorldMapConfig;
  totalHexes: number;
  initialNeutralsCount: number;
  candidateStartsCount: number;
  mapCapacity: number;
  initialNeutrals: HexCoordinates[];
  candidateStarts: HexCoordinates[];
  terrainFeatures: CosmeticFeatureDto[];
  feasibilityScore: number;
}

/**
 * Generate Cosmetic Terrain Features (Trees, Rocks, Lakes, Mountains)
 */
export function generateCosmeticTerrainFeatures(
  config: WorldMapConfig,
  occupiedHexes: Set<string>
): CosmeticFeatureDto[] {
  const rng = createSeededRandom(config.seed + "-terrain");
  const allHexes = getHexesInRadius(config.radius);
  const features: CosmeticFeatureDto[] = [];
  const terrainTypes: CosmeticTerrainType[] = ["TREE", "ROCK", "LAKE", "MOUNTAIN"];

  for (const hex of allHexes) {
    const key = `${hex.q},${hex.r}`;
    if (occupiedHexes.has(key)) continue;

    const roll = rng();
    if (roll < 0.12) {
      const typeIndex = Math.floor(rng() * terrainTypes.length);
      features.push({
        q: hex.q,
        r: hex.r,
        type: terrainTypes[typeIndex],
      });
    }
  }

  return features;
}

/**
 * World Generation Preview
 */
export function generateWorldMapPreview(
  customConfig?: Partial<WorldMapConfig>
): WorldMapPreviewResult {
  const mapConfig: WorldMapConfig = { ...DEFAULT_WORLD_MAP_CONFIG, ...customConfig };
  const rng = createSeededRandom(mapConfig.seed);
  const allHexes = getHexesInRadius(mapConfig.radius);

  // Background initial neutrals (excluding center 0,0 reserved zone)
  const initialNeutrals: HexCoordinates[] = [];
  const occupiedKeys = new Set<string>();
  occupiedKeys.add("0,0"); // Reserve origin

  for (const hex of allHexes) {
    if (hex.q === 0 && hex.r === 0) continue;
    if (rng() < mapConfig.initialNeutralDensity) {
      initialNeutrals.push(hex);
      occupiedKeys.add(`${hex.q},${hex.r}`);
    }
  }

  // Candidate Player Starts ordered center-outward
  const allCandidateStarts: HexCoordinates[] = [];
  const startHexes = [...allHexes].sort((a, b) => {
    const distA = HexDistanceService.distance(0, 0, a.q, a.r);
    const distB = HexDistanceService.distance(0, 0, b.q, b.r);
    return distA - distB;
  });

  for (const candidate of startHexes) {
    const key = `${candidate.q},${candidate.r}`;
    if (occupiedKeys.has(key)) continue;

    const tooClose = allCandidateStarts.some(
      (existing) =>
        HexDistanceService.distance(candidate.q, candidate.r, existing.q, existing.r) <
        mapConfig.minPlayerSeparation
    );
    if (!tooClose) {
      allCandidateStarts.push(candidate);
    }
  }

  const mapCapacity = allCandidateStarts.length;
  const playerLimit = mapConfig.maxPlayers && mapConfig.maxPlayers > 0 ? mapConfig.maxPlayers : mapCapacity;
  const candidateStarts = allCandidateStarts.slice(0, playerLimit);

  // Generate cosmetic terrain features for empty non-settlement hexes
  const candidateKeys = new Set(candidateStarts.map((c) => `${c.q},${c.r}`));
  const reservedForSettlements = new Set([...occupiedKeys, ...candidateKeys]);
  const terrainFeatures = generateCosmeticTerrainFeatures(mapConfig, reservedForSettlements);

  // Evaluate feasibility score for capped candidate starts
  let feasibleCount = 0;
  for (const candidate of candidateStarts) {
    let emptyCount = 0;
    for (let dq = -mapConfig.guaranteedNeutralsMaxDistance; dq <= mapConfig.guaranteedNeutralsMaxDistance; dq++) {
      for (let dr = -mapConfig.guaranteedNeutralsMaxDistance; dr <= mapConfig.guaranteedNeutralsMaxDistance; dr++) {
        if (dq === 0 && dr === 0) continue;
        const targetQ = candidate.q + dq;
        const targetR = candidate.r + dr;
        if (!isWithinRadius(targetQ, targetR, mapConfig.radius)) continue;
        if (HexDistanceService.distance(candidate.q, candidate.r, targetQ, targetR) > mapConfig.guaranteedNeutralsMaxDistance) {
          continue;
        }
        if (!occupiedKeys.has(`${targetQ},${targetR}`)) {
          emptyCount++;
        }
      }
    }
    if (emptyCount >= mapConfig.guaranteedNeutralsCount) {
      feasibleCount++;
    }
  }

  const feasibilityScore =
    candidateStarts.length > 0 ? (feasibleCount / candidateStarts.length) * 100 : 100;

  return {
    mapConfig,
    totalHexes: allHexes.length,
    initialNeutralsCount: initialNeutrals.length,
    candidateStartsCount: candidateStarts.length,
    mapCapacity,
    initialNeutrals,
    candidateStarts,
    terrainFeatures,
    feasibilityScore: Math.round(feasibilityScore * 10) / 10,
  };
}

export interface PlayerSpawnSelection {
  playerHex: HexCoordinates;
  guaranteedNeutrals: HexCoordinates[];
  warning?: string;
}

/**
 * Player Base Spawning Algorithm
 */
export function selectPlayerSpawnHex(
  config: WorldMapConfig,
  occupiedHexes: Set<string>,
  existingPlayerHexes: HexCoordinates[],
  existingNeutralsHexes: HexCoordinates[] = []
): PlayerSpawnSelection | null {
  const allHexes = getHexesInRadius(config.radius);

  const sortedHexes = [...allHexes].sort((a, b) => {
    const distA = HexDistanceService.distance(0, 0, a.q, a.r);
    const distB = HexDistanceService.distance(0, 0, b.q, b.r);
    return distA - distB;
  });

  let fallbackCandidate: { playerHex: HexCoordinates; availableNeutrals: HexCoordinates[] } | null = null;

  for (const candidate of sortedHexes) {
    const candidateKey = `${candidate.q},${candidate.r}`;
    if (occupiedHexes.has(candidateKey)) continue;

    const validSeparation = existingPlayerHexes.every(
      (p) =>
        HexDistanceService.distance(candidate.q, candidate.r, p.q, p.r) >= config.minPlayerSeparation
    );
    if (!validSeparation) continue;

    const existingQualifyingNeutrals = existingNeutralsHexes.filter(
      (n) => HexDistanceService.distance(candidate.q, candidate.r, n.q, n.r) <= config.guaranteedNeutralsMaxDistance
    );

    const neededNeutrals = Math.max(0, config.guaranteedNeutralsCount - existingQualifyingNeutrals.length);

    if (neededNeutrals === 0) {
      return {
        playerHex: candidate,
        guaranteedNeutrals: [],
      };
    }

    const eligibleNeutralCells: HexCoordinates[] = [];
    for (let dq = -config.guaranteedNeutralsMaxDistance; dq <= config.guaranteedNeutralsMaxDistance; dq++) {
      for (let dr = -config.guaranteedNeutralsMaxDistance; dr <= config.guaranteedNeutralsMaxDistance; dr++) {
        if (dq === 0 && dr === 0) continue;
        const nQ = candidate.q + dq;
        const nR = candidate.r + dr;
        if (!isWithinRadius(nQ, nR, config.radius)) continue;
        if (HexDistanceService.distance(candidate.q, candidate.r, nQ, nR) > config.guaranteedNeutralsMaxDistance) {
          continue;
        }
        if (!occupiedHexes.has(`${nQ},${nR}`)) {
          eligibleNeutralCells.push({ q: nQ, r: nR });
        }
      }
    }

    eligibleNeutralCells.sort((a, b) => {
      const distA = HexDistanceService.distance(candidate.q, candidate.r, a.q, a.r);
      const distB = HexDistanceService.distance(candidate.q, candidate.r, b.q, b.r);
      return Math.abs(distA - 2) - Math.abs(distB - 2);
    });

    if (eligibleNeutralCells.length >= neededNeutrals) {
      const selectedNeutrals = eligibleNeutralCells.slice(0, neededNeutrals);
      return {
        playerHex: candidate,
        guaranteedNeutrals: selectedNeutrals,
      };
    }

    if (!fallbackCandidate || eligibleNeutralCells.length > fallbackCandidate.availableNeutrals.length) {
      fallbackCandidate = {
        playerHex: candidate,
        availableNeutrals: eligibleNeutralCells,
      };
    }
  }

  if (fallbackCandidate) {
    return {
      playerHex: fallbackCandidate.playerHex,
      guaranteedNeutrals: fallbackCandidate.availableNeutrals,
      warning: "Could not reserve full guaranteed neutrals count near player start.",
    };
  }

  return null;
}

/**
 * Periodic Neutral Spawning Logic
 */
export function selectPeriodicNeutralSpawnHex(
  config: WorldMapConfig,
  playerBases: HexCoordinates[],
  occupiedHexes: Set<string>,
  randomFn: () => number = Math.random
): HexCoordinates | null {
  if (playerBases.length === 0) return null;

  const baseIndex = Math.floor(randomFn() * playerBases.length);
  const centerBase = playerBases[baseIndex];

  const candidateCells: HexCoordinates[] = [];
  const { periodicSpawnRadiusMin, periodicSpawnRadiusMax, radius: worldRadius } = config;

  for (let dq = -periodicSpawnRadiusMax; dq <= periodicSpawnRadiusMax; dq++) {
    for (let dr = -periodicSpawnRadiusMax; dr <= periodicSpawnRadiusMax; dr++) {
      const targetQ = centerBase.q + dq;
      const targetR = centerBase.r + dr;
      if (!isWithinRadius(targetQ, targetR, worldRadius)) continue;

      const dist = HexDistanceService.distance(centerBase.q, centerBase.r, targetQ, targetR);
      if (dist >= periodicSpawnRadiusMin && dist <= periodicSpawnRadiusMax) {
        if (!occupiedHexes.has(`${targetQ},${targetR}`)) {
          candidateCells.push({ q: targetQ, r: targetR });
        }
      }
    }
  }

  if (candidateCells.length === 0) return null;

  const chosenIndex = Math.floor(randomFn() * candidateCells.length);
  return candidateCells[chosenIndex];
}
