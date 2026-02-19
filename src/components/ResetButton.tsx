import './ResetButton.css';

interface ResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ResetButton({ onClick, disabled = false }: ResetButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="reset-button"
      aria-label="Reset timer"
    >
      <span className="reset-button__dot" aria-hidden="true">•</span>
      RESET
    </button>
  );
}
