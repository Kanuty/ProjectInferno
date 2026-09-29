import { HexCoordinates, WorldMapConfig, NeutralOrigin } from "@project-inferno/contracts";

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
  const hexes: HexCoordinates[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
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
  initialNeutrals: HexCoordinates[];
  candidateStarts: HexCoordinates[];
  feasibilityScore: number;
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
  const candidateStarts: HexCoordinates[] = [];
  const startHexes = [...allHexes].sort((a, b) => {
    const distA = HexDistanceService.distance(0, 0, a.q, a.r);
    const distB = HexDistanceService.distance(0, 0, b.q, b.r);
    return distA - distB;
  });

  for (const candidate of startHexes) {
    const key = `${candidate.q},${candidate.r}`;
    if (occupiedKeys.has(key)) continue;

    // Check separation from previously selected candidates
    const tooClose = candidateStarts.some(
      (existing) =>
        HexDistanceService.distance(candidate.q, candidate.r, existing.q, existing.r) <
        mapConfig.minPlayerSeparation
    );
    if (!tooClose) {
      candidateStarts.push(candidate);
    }
  }

  // Evaluate feasibility score: % of candidate starts with >= guaranteedNeutralsCount empty cells within maxDistance
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
    initialNeutrals,
    candidateStarts,
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
 * Finds center-outward candidate P, reserves 2 guaranteed nearby neutrals within distance <= 4.
 */
export function selectPlayerSpawnHex(
  config: WorldMapConfig,
  occupiedHexes: Set<string>,
  existingPlayerHexes: HexCoordinates[],
  existingNeutralsHexes: HexCoordinates[] = []
): PlayerSpawnSelection | null {
  const allHexes = getHexesInRadius(config.radius);

  // Sort center-outward
  const sortedHexes = [...allHexes].sort((a, b) => {
    const distA = HexDistanceService.distance(0, 0, a.q, a.r);
    const distB = HexDistanceService.distance(0, 0, b.q, b.r);
    return distA - distB;
  });

  let fallbackCandidate: { playerHex: HexCoordinates; availableNeutrals: HexCoordinates[] } | null = null;

  for (const candidate of sortedHexes) {
    const candidateKey = `${candidate.q},${candidate.r}`;
    if (occupiedHexes.has(candidateKey)) continue;

    // Check minimum player separation
    const validSeparation = existingPlayerHexes.every(
      (p) =>
        HexDistanceService.distance(candidate.q, candidate.r, p.q, p.r) >= config.minPlayerSeparation
    );
    if (!validSeparation) continue;

    // Count existing qualifying neutrals within distance <= guaranteedNeutralsMaxDistance
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

    // Find candidate empty hexes for guaranteed neutrals near candidate
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

    // Sort eligible neutral cells by distance to candidate (prefer distance 2..3)
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
 * Periodic Neutral Spawning Logic (Every X days until Y)
 */
export function selectPeriodicNeutralSpawnHex(
  config: WorldMapConfig,
  playerBases: HexCoordinates[],
  occupiedHexes: Set<string>,
  randomFn: () => number = Math.random
): HexCoordinates | null {
  if (playerBases.length === 0) return null;

  // Pick a base randomly from the player's bases
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
