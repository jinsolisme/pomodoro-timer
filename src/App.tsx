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

function toFlipUnits(value: string, splitDigits: boolean): string[] {
  if (!splitDigits) {
    return [value];
  }

  const normalized = value.length >= 2 ? value.slice(-2) : value.padStart(2, '0');
  return [normalized[0] ?? '0', normalized[1] ?? '0'];
}

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
  splitDigits = false,
}: {
  value: string;
  wide?: boolean;
  animate?: boolean;
  plain?: boolean;
  splitDigits?: boolean;
}) {
  const [displayUnits, setDisplayUnits] = useState(() => toFlipUnits(value, splitDigits));
  const [incomingUnits, setIncomingUnits] = useState(() => toFlipUnits(value, splitDigits));
  const [flippingUnits, setFlippingUnits] = useState(() =>
    toFlipUnits(value, splitDigits).map(() => false),
  );
  const displayUnitsRef = useRef(displayUnits);
  const incomingUnitsRef = useRef(incomingUnits);
  const flippingUnitsRef = useRef(flippingUnits);
  const flipTimersRef = useRef<Array<ReturnType<typeof setTimeout> | null>>(
    toFlipUnits(value, splitDigits).map(() => null),
  );

  const clearFlipTimer = useCallback((index: number) => {
    if (flipTimersRef.current[index] !== null) {
      clearTimeout(flipTimersRef.current[index]);
      flipTimersRef.current[index] = null;
    }
  }, []);

  const clearAllFlipTimers = useCallback(() => {
    for (let index = 0; index < flipTimersRef.current.length; index += 1) {
      clearFlipTimer(index);
    }
  }, [clearFlipTimer]);

  const commitUnitsImmediately = useCallback(
    (nextUnits: string[]) => {
      clearAllFlipTimers();
      flipTimersRef.current = nextUnits.map(() => null);

      const resetFlippingUnits = nextUnits.map(() => false);
      displayUnitsRef.current = [...nextUnits];
      incomingUnitsRef.current = [...nextUnits];
      flippingUnitsRef.current = resetFlippingUnits;

      setDisplayUnits([...nextUnits]);
      setIncomingUnits([...nextUnits]);
      setFlippingUnits(resetFlippingUnits);
    },
    [clearAllFlipTimers],
  );

  const startFlipAt = useCallback(
    (index: number, nextUnit: string) => {
      if (nextUnit === displayUnitsRef.current[index]) {
        return;
      }

      clearFlipTimer(index);

      setIncomingUnits((prev) => {
        const next = [...prev];
        next[index] = nextUnit;
        incomingUnitsRef.current = next;
        return next;
      });

      setFlippingUnits((prev) => {
        const next = [...prev];
        next[index] = true;
        flippingUnitsRef.current = next;
        return next;
      });

      flipTimersRef.current[index] = setTimeout(() => {
        setDisplayUnits((prev) => {
          const next = [...prev];
          next[index] = nextUnit;
          displayUnitsRef.current = next;
          return next;
        });

        setIncomingUnits((prev) => {
          const next = [...prev];
          next[index] = nextUnit;
          incomingUnitsRef.current = next;
          return next;
        });

        setFlippingUnits((prev) => {
          const next = [...prev];
          next[index] = false;
          flippingUnitsRef.current = next;
          return next;
        });

        flipTimersRef.current[index] = null;
      }, FLIP_DURATION_MS);
    },
    [clearFlipTimer],
  );

  useEffect(() => {
    const scheduleId = window.setTimeout(() => {
      const nextUnits = toFlipUnits(value, splitDigits);
      if (nextUnits.length !== displayUnitsRef.current.length) {
        commitUnitsImmediately(nextUnits);
      }
    }, 0);

    return () => {
      window.clearTimeout(scheduleId);
    };
  }, [value, splitDigits, commitUnitsImmediately]);

  useEffect(() => {
    const scheduleId = window.setTimeout(() => {
      const nextUnits = toFlipUnits(value, splitDigits);

      if (!animate) {
        const hasDiff = nextUnits.some(
          (unit, index) => unit !== displayUnitsRef.current[index] || flippingUnitsRef.current[index],
        );
        if (hasDiff) {
          commitUnitsImmediately(nextUnits);
        }
        return;
      }

      nextUnits.forEach((unit, index) => {
        if (flippingUnitsRef.current[index]) {
          return;
        }
        if (unit === displayUnitsRef.current[index]) {
          return;
        }
        startFlipAt(index, unit);
      });
    }, 0);

    return () => {
      window.clearTimeout(scheduleId);
    };
  }, [value, animate, splitDigits, flippingUnits, startFlipAt, commitUnitsImmediately]);

  useEffect(() => {
    return () => {
      clearAllFlipTimers();
    };
  }, [clearAllFlipTimers]);

  if (plain) {
    return (
      <div className={`flip-box flip-box--plain${wide ? ' flip-box--wide' : ''}`}>
        {value}
      </div>
    );
  }

  const isAnyFlipping = flippingUnits.some(Boolean);
  const rootClassName = `flip-box${wide ? ' flip-box--wide' : ''}${splitDigits ? ' flip-box--split' : ''}${isAnyFlipping ? ' is-flipping' : ''}`;

  if (splitDigits) {
    return (
      <div className={rootClassName}>
        <div className="flip-box__digit-track">
          {displayUnits.map((displayUnit, index) => {
            const incomingUnit = incomingUnits[index] ?? displayUnit;
            const isDigitFlipping = flippingUnits[index] ?? false;

            return (
              <div className={`flip-box__digit${isDigitFlipping ? ' is-flipping' : ''}`} key={index}>
                <div className="flip-box__digit-half flip-box__digit-half--top">
                  <span>{displayUnit}</span>
                </div>
                <div className="flip-box__digit-half flip-box__digit-half--bottom">
                  <span>{displayUnit}</span>
                </div>
                {isDigitFlipping ? (
                  <>
                    <div className="flip-box__digit-flap flip-box__digit-flap--top">
                      <span>{displayUnit}</span>
                    </div>
                    <div className="flip-box__digit-flap flip-box__digit-flap--bottom">
                      <span>{incomingUnit}</span>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const displayValue = displayUnits[0] ?? value;
  const incomingValue = incomingUnits[0] ?? displayValue;

  return (
    <div className={rootClassName}>
      <div className="flip-box__half flip-box__half--top">
        <span>{displayValue}</span>
      </div>
      <div className="flip-box__half flip-box__half--bottom">
        <span>{displayValue}</span>
      </div>
      {isAnyFlipping ? (
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
          <div className="goal-input-group goal-input-group--mobile">
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
            <FlipBox value={displayMins} animate={shouldAnimateClock} splitDigits />
            <FlipBox value={displaySecs} animate={shouldAnimateClock} splitDigits />
          </div>

          <div className="timer-layout">
            <section className="timer-layout__dial" aria-label="Dial controls">
              {/* Dial */}
              <AnalogDial
                remainingSeconds={remainingSeconds}
                totalSeconds={totalSeconds}
                timerState={state}
                onDragEnd={handleDragEnd}
                onDragPreview={handleDragPreview}
              />

              {/* Reset */}
              <div className="reset-button-wrap reset-button-wrap--mobile">
                <ResetButton onClick={handleReset} disabled={isResetDisabled} />
              </div>
            </section>

            <section className="timer-layout__info" aria-label="Timer status">
              <div className="goal-input-group goal-input-group--tablet">
                <input
                  id="timer-goal-tablet"
                  className="goal-input"
                  type="text"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="Write your goal"
                  maxLength={80}
                />
              </div>

              <div className="tablet-time" role="timer" aria-live="polite" aria-label="Remaining time">
                <FlipBox value={label} wide animate={false} plain />
                <FlipBox value={displayMins} animate={shouldAnimateClock} splitDigits />
                <FlipBox value={displaySecs} animate={shouldAnimateClock} splitDigits />
              </div>

              {/* Status */}
              <div className="status-line">
                <p className="status-message" data-state={state}>
                  {statusText}
                </p>
              </div>

              <div className="reset-button-wrap reset-button-wrap--tablet">
                <ResetButton onClick={handleReset} disabled={isResetDisabled} />
              </div>
            </section>
          </div>

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
              Timer<br />complete
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
