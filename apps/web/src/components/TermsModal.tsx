import React from "react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: "terms" | "privacy";
}

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  onClose,
  documentType,
}) => {
  if (!isOpen) return null;

  const isTerms = documentType === "terms";
  const title = isTerms ? "Terms of Service" : "Privacy Policy";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#18181b",
          border: "1px solid #3f3f46",
          borderRadius: "10px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          color: "#f4f4f5",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #27272a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, color: "#ff922b" }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#a1a1aa",
              fontSize: "20px",
              cursor: "pointer",
              padding: "0 8px",
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: "20px", overflowY: "auto", fontSize: "14px", lineHeight: "1.6", color: "#d4d4d8" }}>
          {isTerms ? (
            <>
              <h4 style={{ color: "#fff", marginTop: 0 }}>1. Acceptance of Terms</h4>
              <p>
                By creating an account or accessing Project Inferno, you agree to be bound by these Terms of Service.
                Project Inferno is a persistent asynchronous strategy game.
              </p>
              <h4 style={{ color: "#fff" }}>2. Player Conduct & Fair Play</h4>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget imperdiet varius,
                sapien elit eleifend justo, nec cursus libero nisi non sem. Automated bots, exploiting gameplay vulnerabilities,
                or harassment of other players is strictly prohibited.
              </p>
              <h4 style={{ color: "#fff" }}>3. Persistent Worlds & Game Progress</h4>
              <p>
                Persistent worlds operate continuously. Game events, building upgrades, and resource calculations run on scheduled timelines
                regardless of player connection state.
              </p>
              <h4 style={{ color: "#fff" }}>4. Termination & Disclaimers</h4>
              <p>
                We reserve the right to modify or discontinue features, wipe test worlds during development baseline updates, or suspend accounts violating conduct guidelines.
              </p>
            </>
          ) : (
            <>
              <h4 style={{ color: "#fff", marginTop: 0 }}>1. Information We Collect</h4>
              <p>
                We collect your account registration information (username, email address, and encrypted password credentials)
                to facilitate player identity and persistent game save states across game worlds.
              </p>
              <h4 style={{ color: "#fff" }}>2. How Information Is Used</h4>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Your email address is solely utilized for account authentication,
                session management, and essential account service notices.
              </p>
              <h4 style={{ color: "#fff" }}>3. Data Protection & Security</h4>
              <p>
                Passwords are standardly hashed prior to storage in authoritative PostgreSQL tables. No plain-text passwords or raw payment credentials are stored by Project Inferno.
              </p>
              <h4 style={{ color: "#fff" }}>4. Third-Party Sharing</h4>
              <p>
                We do not sell, rent, or trade player personal information to third parties.
              </p>
            </>
          )}
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #27272a",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#ff922b",
              color: "#000",
              fontWeight: "bold",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Close Document
          </button>
        </div>
      </div>
    </div>
  );
};
