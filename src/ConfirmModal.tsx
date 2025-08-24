import { useEffect } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  playerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  playerName,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onCancel();
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body">
          <div className="warning-icon">⚠️</div>
          <p className="modal-message">{message}</p>
          <div className="player-highlight">"{playerName}"</div>
          <p className="warning-text">
            This action cannot be undone. All of their words will be permanently
            removed from the game.
          </p>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className="red-button" onClick={onConfirm}>
            Kick Player
          </button>
        </div>
      </div>
    </div>
  );
}
