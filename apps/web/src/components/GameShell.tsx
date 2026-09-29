import React, { useState, useEffect } from "react";
import { BaseDto, WorldDto } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";
import { getRaceDefinition, SELECTABLE_RACES, RACE_DEFINITIONS } from "@project-inferno/game-core";
import { HexMapView } from "./HexMapView";

interface GameShellProps {
  apiClient: ApiClient;
  worldId: string;
  currentUserId: string;
  onExitWorld: () => void;
}

export const GameShell: React.FC<GameShellProps> = ({ apiClient, worldId, currentUserId, onExitWorld }) => {
  const [world, setWorld] = useState<WorldDto | null>(null);
  const [bases, setBases] = useState<BaseDto[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<BaseDto | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string>("HUMAN");
  const [loading, setLoading] = useState<boolean>(true);
  const [joining, setJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorldAndBases = async () => {
    setLoading(true);
    setError(null);
    try {
      const worldsList = await apiClient.getWorlds();
      const currentWorld = worldsList.find((w) => w.id === worldId) || null;
      setWorld(currentWorld);

      const basesList = await apiClient.getWorldBases(worldId);
      setBases(basesList);
    } catch (err: any) {
      setError(err.message || "Failed to load game world details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorldAndBases();
  }, [worldId]);

  const handleJoinWorld = async () => {
    setJoining(true);
    setError(null);
    try {
      await apiClient.joinWorld(worldId, { tintRaceId: selectedRaceId });
      await loadWorldAndBases();
    } catch (err: any) {
      setError(err.message || "Failed to join world.");
    } finally {
      setJoining(false);
    }
  };

  const myBases = bases.filter((b) => b.userId === currentUserId);

  return (
    <div style={{ padding: "20px", background: "#0f172a", minHeight: "85vh", color: "#f8fafc", borderRadius: "12px", border: "1px solid #334155" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #334155", paddingBottom: "12px" }}>
        <div>
          <h2 style={{ margin: 0, color: "#f97316" }}>Game World: {world?.name || worldId}</h2>
          <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
            Status: <strong style={{ color: "#38bdf8" }}>{world?.status}</strong> | Max Players: {world?.maxPlayers} | Your Settlements: {myBases.length}
          </p>
        </div>

        <button
          onClick={onExitWorld}
          style={{ padding: "8px 16px", background: "#334155", color: "#f8fafc", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
        >
          Exit World
        </button>
      </div>

      {error && <div style={{ padding: "10px", backgroundColor: "#7f1d1d", color: "#fca5a5", borderRadius: "6px", marginBottom: "16px" }}>{error}</div>}

      {loading ? (
        <p>Loading world map and player bases...</p>
      ) : selectedVillage ? (
        (() => {
          const raceDef = getRaceDefinition(selectedVillage.tintRaceId);
          return (
            <div style={{ backgroundColor: "#1e293b", padding: "24px", borderRadius: "8px", border: "1px solid #334155" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #475569", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "2rem" }}>{raceDef.icon}</span>
                  <div>
                    <h3 style={{ margin: 0, color: "#f97316" }}>Village Headquarters: {selectedVillage.name}</h3>
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                      Race Presentation: <strong style={{ color: raceDef.ecology.primaryColor }}>{raceDef.name}</strong> ({raceDef.badgeEmoji})
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedVillage(null)} style={{ padding: "8px 16px", backgroundColor: "#334155", color: "#f8fafc", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
                  ← Return to Hex Map
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <h4 style={{ margin: "0 0 8px 0", color: "#38bdf8" }}>General Overview</h4>
                  <p><strong>Coordinates:</strong> ({selectedVillage.q}, {selectedVillage.r})</p>
                  <p><strong>Owner:</strong> {selectedVillage.ownerUsername || "Neutral / Abandoned"}</p>
                  <p><strong>Points:</strong> {selectedVillage.points || 100}</p>
                  <p><strong>Race / Faction:</strong> <span style={{ color: raceDef.ecology.primaryColor, fontWeight: 700 }}>{raceDef.name}</span></p>

                  <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#0f172a", borderRadius: "6px", border: "1px solid #334155" }}>
                    <h5 style={{ margin: "0 0 6px 0", color: raceDef.ecology.primaryColor }}>Ecology & Environment</h5>
                    <p style={{ margin: "2px 0", fontSize: "0.85rem", color: "#cbd5e1" }}><strong>Terrain:</strong> {raceDef.ecology.terrainType}</p>
                    <p style={{ margin: "2px 0", fontSize: "0.85rem", color: "#94a3b8" }}>{raceDef.ecology.description}</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ padding: "16px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#38bdf8" }}>Resource Stores</h4>
                    <p style={{ margin: "4px 0" }}>Production Rate: {selectedVillage.resources?.productionRate || 1}/s</p>
                    <p style={{ margin: "4px 0" }}>Storage Capacity: {selectedVillage.resources?.capacity || 10000}</p>
                  </div>

                  <div style={{ padding: "16px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#38bdf8" }}>Base Structures & Unit Roster</h4>
                    <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>
                      <strong>Main Building:</strong> {raceDef.buildingNames.town_hall} | <strong>Military:</strong> {raceDef.buildingNames.barracks}
                    </p>
                    <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>
                      <strong>Storage:</strong> {raceDef.buildingNames.granary} | <strong>Trade:</strong> {raceDef.buildingNames.market}
                    </p>
                    <p style={{ margin: "8px 0 4px 0", fontSize: "0.85rem", color: "#cbd5e1" }}>
                      <strong>Trainable Troops:</strong> {Object.values(raceDef.unitNames).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : myBases.length === 0 ? (
        <div style={{ padding: "24px", backgroundColor: "#1e293b", borderRadius: "8px", border: "1px solid #334155" }}>
          <h3 style={{ marginTop: 0, color: "#f97316", textAlign: "center" }}>Select Your Race & Spawn Initial Base</h3>
          <p style={{ color: "#94a3b8", textAlign: "center" }}>
            Choose your permanent initial race. Your chosen race determines the visual appearance of your base, environment ecology, structure titles, and unit names.
            <br />
            <em style={{ color: "#eab308" }}>Note: Neutral villages in the world belong to the unselectable Wearebears race. Choice is permanent once spawned.</em>
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", margin: "20px 0" }}>
            {SELECTABLE_RACES.map((raceKey: string) => {
              const def = RACE_DEFINITIONS[raceKey as keyof typeof RACE_DEFINITIONS];
              const isSelected = selectedRaceId === raceKey;
              return (
                <div
                  key={raceKey}
                  onClick={() => setSelectedRaceId(raceKey)}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    backgroundColor: isSelected ? "#0f172a" : "#0f172a80",
                    border: isSelected ? `2px solid ${def.ecology.primaryColor}` : "1px solid #334155",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isSelected ? `0 0 12px ${def.ecology.primaryColor}40` : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "1.8rem" }}>{def.icon}</span>
                    <div>
                      <h4 style={{ margin: 0, color: def.ecology.primaryColor, fontSize: "1rem" }}>{def.name}</h4>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{def.ecology.terrainType}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#cbd5e1", margin: "0 0 8px 0" }}>{def.description}</p>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", borderTop: "1px solid #334155", paddingTop: "6px" }}>
                    <div><strong>Headquarters:</strong> {def.buildingNames.town_hall}</div>
                    <div><strong>Elite Troop:</strong> {def.unitNames.u5}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <button
              onClick={handleJoinWorld}
              disabled={joining}
              style={{ padding: "12px 32px", backgroundColor: "#f97316", color: "#ffffff", border: "none", borderRadius: "6px", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}
            >
              {joining ? "Spawning Base..." : `Spawn ${RACE_DEFINITIONS[selectedRaceId as keyof typeof RACE_DEFINITIONS]?.name || selectedRaceId} Base`}
            </button>
          </div>
        </div>
      ) : (
        world && (
          <HexMapView
            apiClient={apiClient}
            world={world}
            currentUserId={currentUserId}
            onOpenVillageView={(base) => setSelectedVillage(base)}
          />
        )
      )}
    </div>
  );
};
