import React, { useState, useEffect, useRef } from "react";
import { WorldMapConfig, WorldPreviewResponse, WorldStageStatus } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";

interface AdminWorldCreationModalProps {
  apiClient: ApiClient;
  isOpen: boolean;
  onClose: () => void;
  onWorldCreated: () => void;
}

export const AdminWorldCreationModal: React.FC<AdminWorldCreationModalProps> = ({
  apiClient,
  isOpen,
  onClose,
  onWorldCreated,
}) => {
  const [worldName, setWorldName] = useState("Inferno World 1");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [maxPlayers, setMaxPlayers] = useState(100);
  const [isTestOnly, setIsTestOnly] = useState(false);
  const [autoCloseDays, setAutoCloseDays] = useState(20);
  const [status, setStatus] = useState<WorldStageStatus>("planned_open");

  // Map Config Controls
  const [radius, setRadius] = useState(12);
  const [seed, setSeed] = useState("inferno-world-seed");
  const [worldSpeed] = useState(1.0);
  const [armySpeed] = useState(10);
  const [merchantSpeed] = useState(5);
  const [minSeparation, setMinSeparation] = useState(3);
  const [guaranteedNeutrals, setGuaranteedNeutrals] = useState(2);
  const [guaranteedMaxDist] = useState(4);
  const [initialDensity, setInitialDensity] = useState(0.04);
  const [periodicInterval, setPeriodicInterval] = useState(1);
  const [periodicCutoff] = useState(30);

  const [preview, setPreview] = useState<WorldPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getMapConfig = (): Partial<WorldMapConfig> => ({
    radius,
    seed,
    worldSpeed,
    armyMinutesPerHex: armySpeed,
    merchantMinutesPerHex: merchantSpeed,
    minPlayerSeparation: minSeparation,
    guaranteedNeutralsCount: guaranteedNeutrals,
    guaranteedNeutralsMaxDistance: guaranteedMaxDist,
    initialNeutralDensity: initialDensity,
    periodicSpawnIntervalDays: periodicInterval,
    periodicSpawnCutoffDays: periodicCutoff,
  });

  const fetchPreview = async () => {
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await apiClient.adminPreviewWorldGeneration({ mapConfig: getMapConfig() });
      setPreview(res);
    } catch (err: any) {
      setError(err.message || "Failed to load map generation preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
  }, [isOpen]);

  // Render Canvas Minimap Preview
  useEffect(() => {
    if (!preview || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background hex grid bounds
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    const r = preview.mapConfig.radius;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / (2 * r + 4);

    // Draw world radius boundary circle
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, (r + 0.5) * scale, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw initial neutrals (Yellow)
    ctx.fillStyle = "#eab308";
    for (const neutral of preview.initialNeutrals) {
      const x = centerX + (neutral.q + neutral.r / 2) * scale * 1.5;
      const y = centerY + neutral.r * scale * 1.3;
      ctx.beginPath();
      ctx.arc(x, y, scale * 0.4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw candidate player starts (Cyan/Blue)
    ctx.fillStyle = "#38bdf8";
    for (const start of preview.candidateStarts) {
      const x = centerX + (start.q + start.r / 2) * scale * 1.5;
      const y = centerY + start.r * scale * 1.3;
      ctx.beginPath();
      ctx.arc(x, y, scale * 0.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Origin Center Marker (Red)
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(centerX, centerY, scale * 0.6, 0, 2 * Math.PI);
    ctx.fill();
  }, [preview]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiClient.adminCreateWorld({
        name: worldName,
        startsAt: new Date(startsAt).toISOString(),
        maxPlayers,
        isTestOnly,
        autoCloseDays,
        status,
        config: getMapConfig(),
      });
      onWorldCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create world.");
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.85)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px",
    }}>
      <div style={{
        backgroundColor: "#0f172a",
        border: "1px solid #334155",
        borderRadius: "12px",
        width: "900px",
        maxWidth: "95vw",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        color: "#f8fafc",
        padding: "24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #334155", paddingBottom: "12px" }}>
          <h2 style={{ margin: 0, color: "#f97316", fontSize: "1.5rem" }}>Create World & Configure Spawn Rules</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", backgroundColor: "#7f1d1d", color: "#fca5a5", borderRadius: "6px", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Left Column: Basic Details & Parameters */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: 0, color: "#cbd5e1", fontSize: "1.1rem" }}>Basic Settings</h3>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>World Name</label>
              <input type="text" value={worldName} onChange={(e) => setWorldName(e.target.value)} required style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>Opening Time</label>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>Max Players</label>
                <input type="number" min="1" value={maxPlayers} onChange={(e) => setMaxPlayers(parseInt(e.target.value))} required style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>World Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as WorldStageStatus)} style={inputStyle}>
                  <option value="planned_open">Planned Open</option>
                  <option value="planned_closed">Planned Closed</option>
                  <option value="active">Active (Open Now)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>Auto Close (Days)</label>
                <input type="number" min="1" value={autoCloseDays} onChange={(e) => setAutoCloseDays(parseInt(e.target.value))} style={inputStyle} />
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "#cbd5e1", marginTop: "4px" }}>
              <input type="checkbox" checked={isTestOnly} onChange={(e) => setIsTestOnly(e.target.checked)} />
              Restricted to Test Users / Admins Only
            </label>

            <h3 style={{ margin: "12px 0 0 0", color: "#cbd5e1", fontSize: "1.1rem" }}>Map & Spawn Rules</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>Map Radius (Hexes)</label>
                <input type="number" min="5" max="50" value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>World Seed</label>
                <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>Min Player Separation</label>
                <input type="number" min="1" max="10" value={minSeparation} onChange={(e) => setMinSeparation(parseInt(e.target.value))} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>Guaranteed Neutrals</label>
                <input type="number" min="0" max="5" value={guaranteedNeutrals} onChange={(e) => setGuaranteedNeutrals(parseInt(e.target.value))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>Initial Neutral Density</label>
                <input type="number" step="0.01" min="0" max="0.2" value={initialDensity} onChange={(e) => setInitialDensity(parseFloat(e.target.value))} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8" }}>Periodic Spawn Interval (Days)</label>
                <input type="number" min="1" value={periodicInterval} onChange={(e) => setPeriodicInterval(parseInt(e.target.value))} style={inputStyle} />
              </div>
            </div>

            <button type="button" onClick={fetchPreview} disabled={loadingPreview} style={{ ...buttonSecondary, marginTop: "8px" }}>
              {loadingPreview ? "Generating Preview..." : "Update Map Preview"}
            </button>
          </div>

          {/* Right Column: Generation Preview & Feasibility Score */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
            <h3 style={{ margin: 0, color: "#cbd5e1", fontSize: "1.1rem", alignSelf: "flex-start" }}>Generation Preview</h3>

            <div style={{ position: "relative", border: "1px solid #334155", borderRadius: "8px", overflow: "hidden" }}>
              <canvas ref={canvasRef} width={380} height={320} style={{ display: "block", backgroundColor: "#1e293b" }} />
            </div>

            {preview && (
              <div style={{ width: "100%", backgroundColor: "#1e293b", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div><span style={{ color: "#94a3b8" }}>Total Hexes:</span> <strong>{preview.totalHexes}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>Initial Neutrals:</span> <strong style={{ color: "#eab308" }}>{preview.initialNeutralsCount}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>Player Starts:</span> <strong style={{ color: "#38bdf8" }}>{preview.candidateStartsCount}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>Feasibility:</span> <strong style={{ color: preview.feasibilityScore >= 90 ? "#4ade80" : "#f87171" }}>{preview.feasibilityScore}%</strong></div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "auto" }}>
              <button type="button" onClick={onClose} style={{ ...buttonSecondary, flex: 1 }}>Cancel</button>
              <button type="submit" disabled={creating} style={{ ...buttonPrimary, flex: 1 }}>
                {creating ? "Creating World..." : "Create World"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  backgroundColor: "#1e293b",
  border: "1px solid #475569",
  borderRadius: "6px",
  color: "#f8fafc",
  fontSize: "0.9rem",
  marginTop: "4px",
  boxSizing: "border-box",
};

const buttonPrimary: React.CSSProperties = {
  padding: "10px 16px",
  backgroundColor: "#f97316",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonSecondary: React.CSSProperties = {
  padding: "10px 16px",
  backgroundColor: "#334155",
  color: "#f8fafc",
  border: "none",
  borderRadius: "6px",
  fontWeight: 600,
  cursor: "pointer",
};
