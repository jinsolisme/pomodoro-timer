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

const FLIP_DURATION_MS = 360;

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) {
      return;
    }

    const mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQueryList.matches);

    updatePreference();
    mediaQueryList.addEventListener('change', updatePreference);

    return () => {
      mediaQueryList.removeEventListener('change', updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}

function FlipBox({
  value,
  wide = false,
  animate = true,
  plain = false,
}: {
  value: string;
  wide?: boolean;
  animate?: boolean;
  plain?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [incomingValue, setIncomingValue] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const displayValueRef = useRef(value);
  const isFlippingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlipTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const commitImmediately = useCallback(
    (nextValue: string) => {
      clearFlipTimer();
      isFlippingRef.current = false;
      setIsFlipping(false);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);
      setIncomingValue(nextValue);
    },
    [clearFlipTimer],
  );

  const startFlip = useCallback(
    (nextValue: string) => {
      if (nextValue === displayValueRef.current) {
        return;
      }

      clearFlipTimer();
      setIncomingValue(nextValue);
      setIsFlipping(true);
      isFlippingRef.current = true;

      timerRef.current = setTimeout(() => {
        displayValueRef.current = nextValue;
        setDisplayValue(nextValue);
        setIncomingValue(nextValue);
        setIsFlipping(false);
        isFlippingRef.current = false;
        timerRef.current = null;
      }, FLIP_DURATION_MS);
    },
    [clearFlipTimer],
  );

  useEffect(() => {
    const scheduleId = window.setTimeout(() => {
      if (!animate) {
        if (value !== displayValueRef.current || isFlippingRef.current) {
          commitImmediately(value);
        }
        return;
      }

      if (isFlippingRef.current || value === displayValueRef.current) {
        return;
      }

      startFlip(value);
    }, 0);

    return () => {
      window.clearTimeout(scheduleId);
    };
  }, [value, animate, isFlipping, startFlip, commitImmediately]);

  useEffect(() => {
    return () => {
      clearFlipTimer();
    };
  }, [clearFlipTimer]);

  if (plain) {
    return (
      <div className={`flip-box flip-box--plain${wide ? ' flip-box--wide' : ''}`}>
        {value}
      </div>
    );
  }

  return (
    <div className={`flip-box${wide ? ' flip-box--wide' : ''}${isFlipping ? ' is-flipping' : ''}`}>
      <div className="flip-box__half flip-box__half--top">
        <span>{displayValue}</span>
      </div>
      <div className="flip-box__half flip-box__half--bottom">
        <span>{displayValue}</span>
      </div>
      {isFlipping ? (
        <>
          <div className="flip-box__flap flip-box__flap--top">
            <span>{displayValue}</span>
          </div>
          <div className="flip-box__flap flip-box__flap--bottom">
            <span>{incomingValue}</span>
          </div>
        </>
      ) : null}
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
  const prefersReducedMotion = usePrefersReducedMotion();
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
  const shouldAnimateClock = !prefersReducedMotion && !isDialDragging;

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
            <FlipBox value={label} wide animate={false} plain />
            <FlipBox value={displayMins} animate={shouldAnimateClock} />
            <FlipBox value={displaySecs} animate={shouldAnimateClock} />
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
