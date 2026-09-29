import React, { useState, useEffect } from "react";
import { BaseDto, WorldDto } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";
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
      await apiClient.joinWorld(worldId);
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
        <div style={{ backgroundColor: "#1e293b", padding: "24px", borderRadius: "8px", border: "1px solid #334155" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #475569", paddingBottom: "12px" }}>
            <h3 style={{ margin: 0, color: "#f97316" }}>Village Headquarters: {selectedVillage.name}</h3>
            <button onClick={() => setSelectedVillage(null)} style={{ padding: "8px 16px", backgroundColor: "#334155", color: "#f8fafc", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
              ← Return to Hex Map
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <p><strong>Coordinates:</strong> ({selectedVillage.q}, {selectedVillage.r})</p>
              <p><strong>Owner:</strong> {selectedVillage.ownerUsername || "Neutral / Abandoned"}</p>
              <p><strong>Points:</strong> {selectedVillage.points || 100}</p>
              <p><strong>Race / Faction:</strong> {selectedVillage.tintRaceId || "Standard Human"}</p>
            </div>

            <div style={{ padding: "16px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#38bdf8" }}>Resource Stores</h4>
              <p style={{ margin: "4px 0" }}>Production Rate: {selectedVillage.resources?.productionRate || 1}/s</p>
              <p style={{ margin: "4px 0" }}>Storage Capacity: {selectedVillage.resources?.capacity || 10000}</p>
            </div>
          </div>
        </div>
      ) : myBases.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#1e293b", borderRadius: "8px" }}>
          <h3>You do not have a base in this world yet.</h3>
          <p style={{ color: "#94a3b8" }}>Join now to automatically spawn your starting base and 2 nearby guaranteed neutral villages!</p>
          <button
            onClick={handleJoinWorld}
            disabled={joining}
            style={{ padding: "12px 24px", backgroundColor: "#f97316", color: "#ffffff", border: "none", borderRadius: "6px", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
          >
            {joining ? "Spawning Base..." : "Spawn Base in World"}
          </button>
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
