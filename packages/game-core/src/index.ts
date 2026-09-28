export interface ResourceCalculationInput {
  amountAtReference: number;
  productionRate: number; // units per second
  referenceAt: Date;
  effectiveTime: Date;
  capacity: number;
}

/**
 * Calculates current resource amounts deterministically using timestamps, rates, and reference values.
 * Pure function: Does not rely on global system time or external side-effects.
 */
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
  speed: number; // distance per second
  startTime: Date;
}

/**
 * Calculates deterministic movement arrival time based on Euclidean distance and speed.
 */
export function calculateArrivalAt(input: MovementEtaInput): Date {
  const { startX, startY, targetX, targetY, speed, startTime } = input;
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const durationSeconds = speed > 0 ? distance / speed : 0;
  return new Date(startTime.getTime() + durationSeconds * 1000);
}
