import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalogDial } from './components/AnalogDial';
import { ResetButton } from './components/ResetButton';
import { useTimer } from './hooks/useTimer';
import type { TimerState } from './hooks/useTimer';
import { installAudioUnlock } from './utils/sound';
import './styles/app.css';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function FlipBox({ text, wide = false }: { text: string; wide?: boolean }) {
  return (
    <div className={`flip-box${wide ? ' flip-box--wide' : ''}`}>
      {text}
    </div>
  );
}

function getLabel(state: TimerState, totalSeconds: number): string {
  if (state === 'running') return 'RUN';
  if (state === 'done') return 'END';
  if (totalSeconds > 0) return 'SET';
  return 'FOC';
}

export default function App() {
  const { remainingSeconds, state, start, reset } = useTimer();
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [goal, setGoal] = useState('');
  const [dragPreviewMinutes, setDragPreviewMinutes] = useState(0);
  const [isDialDragging, setIsDialDragging] = useState(false);
  const [isCompletionDismissed, setIsCompletionDismissed] = useState(false);
  const completionAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const isCompletionModalOpen = state === 'done' && !isCompletionDismissed;

  const clearCompletionTimer = useCallback(() => {
    if (completionAutoCloseTimerRef.current !== null) {
      clearTimeout(completionAutoCloseTimerRef.current);
      completionAutoCloseTimerRef.current = null;
    }
  }, []);

  const closeCompletionModal = useCallback(() => {
    clearCompletionTimer();
    setIsCompletionDismissed(true);
  }, [clearCompletionTimer]);

  useEffect(() => {
    installAudioUnlock();
  }, []);

  useEffect(() => {
    if (!isCompletionModalOpen) {
      clearCompletionTimer();
      return;
    }

    completionCloseButtonRef.current?.focus();
    completionAutoCloseTimerRef.current = setTimeout(() => {
      setIsCompletionDismissed(true);
      completionAutoCloseTimerRef.current = null;
    }, 4000);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCompletionModal();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      clearCompletionTimer();
    };
  }, [isCompletionModalOpen, closeCompletionModal, clearCompletionTimer]);

  const handleDragEnd = useCallback(
    (minutes: number) => {
      const seconds = minutes * 60;
      setIsCompletionDismissed(false);
      setTotalSeconds(seconds);
      start(seconds);
    },
    [start],
  );

  const handleReset = useCallback(() => {
    closeCompletionModal();
    reset();
    setTotalSeconds(0);
    setDragPreviewMinutes(0);
    setIsDialDragging(false);
    setIsCompletionDismissed(true);
  }, [reset, closeCompletionModal]);

  const handleDragPreview = useCallback(
    ({ isDragging, minutes }: { isDragging: boolean; minutes: number }) => {
      setIsDialDragging(isDragging);
      setDragPreviewMinutes(minutes);
    },
    [],
  );

  const isResetDisabled = state === 'idle' && totalSeconds === 0;

  const statusText =
    state === 'running'
      ? 'Focus session in progress.'
      : state === 'done'
        ? 'Session complete. Nice work.'
        : 'Rotate the dial to set focus time.';

  const label = getLabel(state, totalSeconds);
  const previewSeconds = isDialDragging ? dragPreviewMinutes * 60 : remainingSeconds;
  const shouldShowPlaceholder = state === 'idle' && totalSeconds === 0 && !isDialDragging;
  const displayMins = shouldShowPlaceholder
    ? '--'
    : pad(Math.floor(previewSeconds / 60));
  const displaySecs = shouldShowPlaceholder
    ? '--'
    : pad(previewSeconds % 60);
  const trimmedGoal = goal.trim();
  const completionDescription = trimmedGoal
    ? `Goal complete: ${trimmedGoal}`
    : 'Session complete. Take a short break and start the next round.';

  return (
    <div className="app-shell">
      <div className="app-outer">
        <main className="app-frame">
          <div className="goal-input-group">
            <input
              id="timer-goal"
              className="goal-input"
              type="text"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Write your goal"
              maxLength={80}
            />
          </div>

          {/* Flip-clock header */}
          <div className="flip-header" role="timer" aria-live="polite" aria-label="Timer display">
            <FlipBox text={label} wide />
            <FlipBox text={displayMins} />
            <FlipBox text={displaySecs} />
          </div>

          {/* Status */}
          <div className="status-line">
            <p className="status-message" data-state={state}>
              {statusText}
            </p>
          </div>

          {/* Dial */}
          <AnalogDial
            remainingSeconds={remainingSeconds}
            totalSeconds={totalSeconds}
            timerState={state}
            onDragEnd={handleDragEnd}
            onDragPreview={handleDragPreview}
          />

          {/* Reset */}
          <ResetButton onClick={handleReset} disabled={isResetDisabled} />

        </main>
      </div>

      {isCompletionModalOpen ? (
        <div className="completion-modal-backdrop" role="presentation">
          <section
            className="completion-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-modal-title"
            aria-describedby="completion-modal-description"
          >
            <h2 id="completion-modal-title" className="completion-modal-title">
              Timer complete
            </h2>
            <p id="completion-modal-description" className="completion-modal-description">
              {completionDescription}
            </p>
            <button
              ref={completionCloseButtonRef}
              type="button"
              className="completion-modal-button"
              onClick={closeCompletionModal}
            >
              OK
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
