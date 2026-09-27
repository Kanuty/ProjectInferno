import React from "react";
import { PlayerBaseDto } from "@project-inferno/contracts";
import { InfernoApiClient } from "@project-inferno/api-client";

interface GameShellProps {
  apiClient: InfernoApiClient;
  worldId: string;
  onExitWorld: () => void;
}

export const GameShell: React.FC<GameShellProps> = ({ apiClient, worldId, onExitWorld }) => {
  const [bases, setBases] = React.useState<PlayerBaseDto[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadBases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getPlayerBases(worldId);
      setBases(data);
    } catch (err: any) {
      setError(err.message || "Failed to load player bases.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadBases();
  }, [worldId]);

  return (
    <div style={{ padding: "20px", background: "#1a232a", borderRadius: "8px", border: "1px solid #2b3a42" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Game Shell (World: {worldId})</h3>
        <button
          onClick={onExitWorld}
          style={{ padding: "6px 12px", background: "#ff6b6b", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Exit to Account Portal
        </button>
      </div>

      <p style={{ color: "#aaa" }}>Active World Context Loaded. Showing Player Bases & Command Overview.</p>

      {loading && <p>Loading player bases...</p>}
      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}

      {!loading && !error && (
        <div>
          <h4>Your Player Bases</h4>
          {bases.length === 0 ? (
            <p style={{ color: "#aaa" }}>No bases found in this world.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px" }}>
              {bases.map((base) => (
                <div key={base.id} style={{ padding: "12px", background: "#25333d", borderRadius: "6px" }}>
                  <h5 style={{ margin: "0 0 6px 0" }}>{base.name}</h5>
                  <p style={{ margin: "2px 0", fontSize: "14px" }}>Position: ({base.positionX}, {base.positionY})</p>
                  <p style={{ margin: "2px 0", fontSize: "14px" }}>Resource Ref Amount: {base.resources.amountAtReference}</p>
                  <p style={{ margin: "2px 0", fontSize: "14px" }}>Production Rate: {base.resources.productionRate}/s</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
