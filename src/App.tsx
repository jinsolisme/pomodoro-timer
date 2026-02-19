import { useCallback, useEffect, useState } from 'react';
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

  useEffect(() => {
    installAudioUnlock();
  }, []);

  const handleDragEnd = useCallback(
    (minutes: number) => {
      const seconds = minutes * 60;
      setTotalSeconds(seconds);
      start(seconds);
    },
    [start],
  );

  const handleReset = useCallback(() => {
    reset();
    setTotalSeconds(0);
    setDragPreviewMinutes(0);
    setIsDialDragging(false);
  }, [reset]);

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
    </div>
  );
}
