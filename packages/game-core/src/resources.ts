import {
  ResourceType,
  ResourceStorageDto,
  BuildingTypeId,
} from "@project-inferno/contracts";
import { getRaceNativeResources } from "./buildings.js";

export const ALL_RESOURCE_TYPES: ResourceType[] = [
  "BUILDING_MATERIAL",
  "SOULS",
  "LIVESTOCK",
  "REMAINS",
  "DIVINE_GRACE",
  "HELLFIRE_ESSENCE",
  "PRIMAL_FURY",
  "BLOOD_ESSENCE",
  "GRAVE_DUST",
  "VOID_ICHOR",
];

export const BASE_RESOURCE_CAPACITY = 1000;
export const VAULT_CAPACITY_PER_LEVEL = 1500;

/**
 * Calculates individual max capacity for a resource given Vault (B09) building level.
 */
export function calculateResourceCapacity(vaultLevel: number = 0): number {
  return BASE_RESOURCE_CAPACITY + Math.max(0, vaultLevel) * VAULT_CAPACITY_PER_LEVEL;
}

/**
 * Calculates resource production rates (units per second) for a base based on building levels and race tint.
 */
export function calculateBaseProductionRates(
  buildings: Record<BuildingTypeId, number>,
  tintRaceId?: string | null
): Record<ResourceType, number> {
  const rates: Record<ResourceType, number> = {
    BUILDING_MATERIAL: 0,
    SOULS: 0,
    LIVESTOCK: 0,
    REMAINS: 0,
    DIVINE_GRACE: 0,
    HELLFIRE_ESSENCE: 0,
    PRIMAL_FURY: 0,
    BLOOD_ESSENCE: 0,
    GRAVE_DUST: 0,
    VOID_ICHOR: 0,
  };

  // Material Producer (B02) produces BUILDING_MATERIAL
  const b02Level = buildings["B02"] || 0;
  if (b02Level > 0) {
    rates["BUILDING_MATERIAL"] = b02Level * 0.1; // 0.1 units/sec = 360 units/hr per level
  }

  const { nativeA, nativeB } = getRaceNativeResources(tintRaceId);

  // Native-A Producer (B03) produces Native-A resource
  const b03Level = buildings["B03"] || 0;
  if (b03Level > 0 && nativeA) {
    rates[nativeA] += b03Level * 0.05; // 0.05 units/sec = 180 units/hr per level
  }

  // Native-B Producer (B04) produces Native-B resource
  const b04Level = buildings["B04"] || 0;
  if (b04Level > 0 && nativeB) {
    rates[nativeB] += b04Level * 0.02; // 0.02 units/sec = 72 units/hr per level
  }

  return rates;
}

/**
 * Returns initial multi-resource storage state for a newly created village/base.
 */
export function getInitialResourceStorages(
  vaultLevel: number = 0,
  initialMaterial: number = 200
): Record<ResourceType, ResourceStorageDto> {
  const capacity = calculateResourceCapacity(vaultLevel);
  const nowStr = new Date().toISOString();

  const result = {} as Record<ResourceType, ResourceStorageDto>;
  for (const rType of ALL_RESOURCE_TYPES) {
    result[rType] = {
      resourceType: rType,
      amount: rType === "BUILDING_MATERIAL" ? initialMaterial : 0,
      productionRate: 0,
      capacity,
      referenceAt: nowStr,
    };
  }
  return result;
}

export interface VillageResourceCalculationInput {
  buildings: Record<BuildingTypeId, number>;
  tintRaceId?: string | null;
  currentStorages: Partial<Record<ResourceType, ResourceStorageDto>>;
  effectiveTime: Date;
}

/**
 * Pure function to calculate generated resources for a village/base up to effectiveTime.
 * Enforces separate max capacity per resource.
 */
export function calculateBaseResources(
  input: VillageResourceCalculationInput
): Record<ResourceType, ResourceStorageDto> {
  const { buildings, tintRaceId, currentStorages, effectiveTime } = input;
  const vaultLevel = buildings["B09"] || 0;
  const capacityPerResource = calculateResourceCapacity(vaultLevel);
  const productionRates = calculateBaseProductionRates(buildings, tintRaceId);

  const updatedStorages = {} as Record<ResourceType, ResourceStorageDto>;

  for (const rType of ALL_RESOURCE_TYPES) {
    const existing = currentStorages[rType];
    const rate = productionRates[rType] || 0;

    let amount = 0;
    let refDate = effectiveTime;

    if (existing) {
      amount = existing.amount;
      refDate = new Date(existing.referenceAt);
    } else if (rType === "BUILDING_MATERIAL") {
      amount = 200;
    }

    const elapsedSeconds = Math.max(0, (effectiveTime.getTime() - refDate.getTime()) / 1000);
    const produced = elapsedSeconds * rate;
    const newAmount = Math.min(capacityPerResource, Math.max(0, amount + produced));

    updatedStorages[rType] = {
      resourceType: rType,
      amount: Math.round(newAmount * 100) / 100,
      productionRate: rate,
      capacity: capacityPerResource,
      referenceAt: effectiveTime.toISOString(),
    };
  }

  return updatedStorages;
}
