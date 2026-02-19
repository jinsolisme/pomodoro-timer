import { useCallback, useEffect, useRef, useState } from 'react';
import { playAlarm, primeAlarmAudio } from '../utils/sound';

export type TimerState = 'idle' | 'running' | 'done';

interface UseTimerReturn {
  remainingSeconds: number;
  state: TimerState;
  start: (totalSeconds: number) => void;
  reset: () => void;
}

export function useTimer(): UseTimerReturn {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [state, setState] = useState<TimerState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmFiredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(
    (totalSeconds: number) => {
      // Always restart from the new value so dragging while running reconfigures immediately.
      primeAlarmAudio();
      clearTimer();
      alarmFiredRef.current = false;
      setRemainingSeconds(totalSeconds);
      setState('running');

      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearTimer],
  );

  const reset = useCallback(() => {
    clearTimer();
    alarmFiredRef.current = false;
    setRemainingSeconds(0);
    setState('idle');
  }, [clearTimer]);

  // Watch for completion
  useEffect(() => {
    if (state === 'running' && remainingSeconds === 0) {
      clearTimer();
      setState('done');
      if (!alarmFiredRef.current) {
        alarmFiredRef.current = true;
        playAlarm();
      }
    }
  }, [remainingSeconds, state, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { remainingSeconds, state, start, reset };
}
