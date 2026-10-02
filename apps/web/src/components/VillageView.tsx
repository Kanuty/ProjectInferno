import React, { useState, useEffect } from "react";
import {
  BaseDto,
  BaseBuildingDto,
  ResourceType,
  ResourceStorageDto,
  BuildingTypeId,
} from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";
import { getRaceDefinition, BUILDING_DEFINITIONS } from "@project-inferno/game-core";

interface VillageViewProps {
  apiClient: ApiClient;
  village: BaseDto;
  isOwner: boolean;
  onBackToMap: () => void;
  onVillageUpdated?: () => void;
}

const RESOURCE_LABELS: Record<ResourceType, { name: string; icon: string; color: string }> = {
  BUILDING_MATERIAL: { name: "Building Material", icon: "🪵", color: "#f97316" },
  SOULS: { name: "Souls", icon: "✨", color: "#eab308" },
  LIVESTOCK: { name: "Livestock", icon: "🌾", color: "#a855f7" },
  REMAINS: { name: "Remains", icon: "💀", color: "#22c55e" },
  DIVINE_GRACE: { name: "Divine Grace", icon: "☀️", color: "#fef08a" },
  HELLFIRE_ESSENCE: { name: "Hellfire Essence", icon: "🔥", color: "#ef4444" },
  PRIMAL_FURY: { name: "Primal Fury", icon: "🐾", color: "#eab308" },
  BLOOD_ESSENCE: { name: "Blood Essence", icon: "🩸", color: "#ec4899" },
  GRAVE_DUST: { name: "Grave Dust", icon: "☠️", color: "#a1a1aa" },
  VOID_ICHOR: { name: "Void Ichor", icon: "👁️", color: "#818cf8" },
};

export const VillageView: React.FC<VillageViewProps> = ({
  apiClient,
  village,
  isOwner,
  onBackToMap,
  onVillageUpdated,
}) => {
  const raceDef = getRaceDefinition(village.tintRaceId);
  const [buildings, setBuildings] = useState<BaseBuildingDto[]>([]);
  const [resources, setResources] = useState<Partial<Record<ResourceType, ResourceStorageDto>>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [upgradingType, setUpgradingType] = useState<BuildingTypeId | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const loadVillageData = async () => {
    try {
      const [buildingsData, resourcesData] = await Promise.all([
        apiClient.getBaseBuildings(village.id),
        apiClient.getBaseResources(village.id),
      ]);
      setBuildings(buildingsData);
      setResources(resourcesData);
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to load village details.", isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVillageData();
    const interval = setInterval(() => {
      loadVillageData();
    }, 5000);
    return () => clearInterval(interval);
  }, [village.id]);

  const mainBuilding = buildings.find((b) => b.buildingType === "B01");
  const mainBuildingLevel = mainBuilding?.level || 1;

  const handleUpgrade = async (buildingType: BuildingTypeId) => {
    setUpgradingType(buildingType);
    setStatusMessage(null);
    try {
      const res = await apiClient.upgradeBuilding(village.id, buildingType);
      setStatusMessage({ text: res.message, isError: false });
      setBuildings(res.buildings);
      setResources(res.resources);
      if (onVillageUpdated) onVillageUpdated();
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Upgrade failed.", isError: true });
    } finally {
      setUpgradingType(null);
    }
  };

  return (
    <div style={{ backgroundColor: "#1e293b", padding: "24px", borderRadius: "12px", border: "1px solid #334155", color: "#f8fafc" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #475569", paddingBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "2.5rem" }}>{raceDef.icon}</span>
          <div>
            <h2 style={{ margin: 0, color: "#f97316" }}>{village.name} (Town View)</h2>
            <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "4px" }}>
              Coordinates: ({village.q}, {village.r}) | Owner: <strong style={{ color: "#38bdf8" }}>{village.ownerUsername || "Neutral / Abandoned"}</strong> | Race: <strong style={{ color: raceDef.ecology.primaryColor }}>{raceDef.name}</strong>
            </div>
          </div>
        </div>

        <button
          onClick={onBackToMap}
          style={{ padding: "10px 20px", backgroundColor: "#334155", color: "#f8fafc", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
        >
          ← Return to World Map
        </button>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: statusMessage.isError ? "#7f1d1d" : "#14532d",
            color: statusMessage.isError ? "#fca5a5" : "#86efac",
            border: `1px solid ${statusMessage.isError ? "#991b1b" : "#166534"}`,
            borderRadius: "8px",
            marginBottom: "20px",
            fontWeight: "bold",
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Main Building Spotlight Picture / Banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${raceDef.ecology.primaryColor}22 0%, #0f172a 100%)`,
          border: `2px solid ${raceDef.ecology.primaryColor}80`,
          borderRadius: "10px",
          padding: "20px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div
          style={{
            width: "90px",
            height: "90px",
            borderRadius: "12px",
            backgroundColor: "#0f172a",
            border: `2px solid ${raceDef.ecology.primaryColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "3rem",
            boxShadow: `0 0 16px ${raceDef.ecology.primaryColor}40`,
          }}
        >
          🏰
        </div>

        <div>
          <span style={{ fontSize: "0.8rem", color: raceDef.ecology.primaryColor, fontWeight: "bold", textTransform: "uppercase" }}>
            Town Center / Main Building
          </span>
          <h3 style={{ margin: "2px 0 6px 0", color: "#f97316" }}>
            {mainBuilding?.displayName || raceDef.buildingNames.town_hall || "Core Seat"} (Level {mainBuildingLevel})
          </h3>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#cbd5e1" }}>
            {BUILDING_DEFINITIONS["B01"].description}
          </p>
          <div style={{ marginTop: "8px", fontSize: "0.85rem", color: "#86efac", fontWeight: "bold" }}>
            ⚡ Main Building Speed Bonus: +{((1 + 0.1 * (mainBuildingLevel - 1) - 1) * 100).toFixed(0)}% faster construction throughput across all town structures.
          </div>
        </div>
      </div>

      {/* Village Resource Stores Panel */}
      <div style={{ backgroundColor: "#0f172a", padding: "16px 20px", borderRadius: "10px", border: "1px solid #334155", marginBottom: "24px" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#38bdf8", fontSize: "1.1rem" }}>
          📦 Village Resource Stores (Separated Storage Max Capacity)
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          {Object.entries(RESOURCE_LABELS).map(([rType, label]) => {
            const storage = resources[rType as ResourceType];
            const amount = storage ? Math.floor(storage.amount) : 0;
            const rate = storage ? storage.productionRate : 0;
            const cap = storage ? storage.capacity : 1000;
            const isFull = amount >= cap;

            return (
              <div
                key={rType}
                style={{
                  backgroundColor: "#1e293b",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${label.color}40`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: label.color }}>
                    {label.icon} {label.name}
                  </span>
                  {rate > 0 && (
                    <span style={{ fontSize: "0.75rem", color: "#86efac", fontWeight: "bold" }}>
                      +{(rate * 60).toFixed(0)}/m
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: isFull ? "#ef4444" : "#f8fafc" }}>
                  {amount.toLocaleString()} <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>/ {cap.toLocaleString()}</span>
                </div>

                <div style={{ width: "100%", height: "4px", backgroundColor: "#334155", borderRadius: "2px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (amount / cap) * 100)}%`,
                      height: "100%",
                      backgroundColor: isFull ? "#ef4444" : label.color,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 14 Buildable Structures Grid */}
      <h3 style={{ margin: "0 0 16px 0", color: "#f97316", fontSize: "1.2rem" }}>
        🏗️ Town Infrastructure & Buildable Structures ({buildings.length} Buildings)
      </h3>

      {loading ? (
        <p>Loading base buildings...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          {buildings.map((b) => {
            const isUpgradingThis = upgradingType === b.buildingType;
            const def = BUILDING_DEFINITIONS[b.buildingType];

            return (
              <div
                key={b.buildingType}
                style={{
                  backgroundColor: "#0f172a",
                  padding: "16px",
                  borderRadius: "10px",
                  border: b.level > 0 ? "1px solid #334155" : "1px dashed #475569",
                  opacity: b.level > 0 ? 1 : 0.85,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "1.05rem" }}>
                        {b.displayName}
                      </h4>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        ({b.canonicalName} - {b.buildingType})
                      </span>
                    </div>

                    <span
                      style={{
                        padding: "2px 8px",
                        backgroundColor: b.level > 0 ? "#1e3a8a" : "#334155",
                        color: b.level > 0 ? "#93c5fd" : "#94a3b8",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                      }}
                    >
                      Lv {b.level} / {b.maxLevel}
                    </span>
                  </div>

                  <p style={{ fontSize: "0.85rem", color: "#cbd5e1", margin: "0 0 12px 0", lineHeight: "1.3" }}>
                    {def.description}
                  </p>

                  {/* Prerequisites indicator if not met */}
                  {!b.isUpgradeable && b.level < b.maxLevel && b.prerequisites.length > 0 && (
                    <div style={{ fontSize: "0.75rem", color: "#fca5a5", backgroundColor: "#450a0a", padding: "6px 10px", borderRadius: "4px", marginBottom: "10px" }}>
                      ⚠️ Requires: {b.prerequisites.map((p) => `${BUILDING_DEFINITIONS[p.buildingType].canonicalName} Lv${p.level}`).join(", ")}
                    </div>
                  )}

                  {/* Cost & Build Duration */}
                  {b.nextLevelCost && (
                    <div style={{ fontSize: "0.8rem", backgroundColor: "#1e293b", padding: "8px 10px", borderRadius: "6px", marginBottom: "12px" }}>
                      <div style={{ fontWeight: "bold", color: "#94a3b8", marginBottom: "4px" }}>
                        Cost for Level {b.level + 1}:
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {Object.entries(b.nextLevelCost).map(([rType, reqAmount]) => {
                          const currentAmt = resources[rType as ResourceType]?.amount || 0;
                          const hasEnough = currentAmt >= reqAmount!;
                          const label = RESOURCE_LABELS[rType as ResourceType];

                          return (
                            <span
                              key={rType}
                              style={{
                                color: hasEnough ? "#86efac" : "#fca5a5",
                                fontWeight: "bold",
                              }}
                            >
                              {label?.icon} {reqAmount} {label?.name || rType}
                            </span>
                          );
                        })}
                      </div>

                      {b.buildDurationSeconds !== undefined && (
                        <div style={{ marginTop: "6px", color: "#38bdf8", fontSize: "0.75rem" }}>
                          ⏱️ Construction time: ~{b.buildDurationSeconds}s (accelerated by Main Building)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isOwner && (
                  <button
                    onClick={() => handleUpgrade(b.buildingType)}
                    disabled={!b.isUpgradeable || isUpgradingThis}
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: b.isUpgradeable ? "#f97316" : "#334155",
                      color: b.isUpgradeable ? "#000000" : "#94a3b8",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      cursor: b.isUpgradeable ? "pointer" : "not-allowed",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isUpgradingThis
                      ? "Constructing..."
                      : b.level >= b.maxLevel
                      ? "Max Level Reached"
                      : b.level === 0
                      ? `Build ${b.displayName}`
                      : `Upgrade to Level ${b.level + 1}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
