let audioCtx: AudioContext | null = null;
let audioUnlockInstalled = false;
let isAudioUnlocked = false;
let unlockInFlight: Promise<void> | null = null;

interface AlarmPreset {
  beepCount: number;
  beepDuration: number;
  beepGap: number;
  startFrequency: number;
  endFrequency: number;
  gain: number;
  waveType: OscillatorType;
}

const LOW_NOTIFICATION_PRESET: AlarmPreset = {
  beepCount: 4,
  beepDuration: 0.2,
  beepGap: 0.18,
  startFrequency: 520,
  endFrequency: 470,
  gain: 0.18,
  waveType: 'triangle',
};

type WebkitWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    const AudioContextCtor =
      window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }
    audioCtx = new AudioContextCtor();
  }
  return audioCtx;
}

function scheduleAlarm(ctx: AudioContext): void {
  const preset = LOW_NOTIFICATION_PRESET;

  for (let i = 0; i < preset.beepCount; i++) {
    const startTime = ctx.currentTime + i * (preset.beepDuration + preset.beepGap);

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = preset.waveType;
    oscillator.frequency.setValueAtTime(preset.startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      preset.endFrequency,
      startTime + preset.beepDuration,
    );

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(
      preset.gain,
      startTime + Math.min(0.025, preset.beepDuration / 3),
    );
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + preset.beepDuration);

    oscillator.start(startTime);
    oscillator.stop(startTime + preset.beepDuration + 0.02);
  }
}

function playSilentUnlockPulse(ctx: AudioContext): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, ctx.currentTime);

  // Keep gain near zero to avoid audible click while still touching the output path.
  gainNode.gain.setValueAtTime(0.00001, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.015);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.02);
}

async function unlockAudioContext(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  playSilentUnlockPulse(ctx);
  isAudioUnlocked = true;
}

function playVibrationFallback(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([140, 90, 140, 90, 220]);
  }
}

export function primeAlarmAudio(): void {
  const ctx = getAudioContext();
  if (!ctx || isAudioUnlocked || unlockInFlight) {
    return;
  }

  unlockInFlight = unlockAudioContext(ctx)
    .catch(() => {
      // Ignore resume errors; we'll retry on the next gesture.
    })
    .finally(() => {
      unlockInFlight = null;
    });
}

export function playAlarm(): void {
  const ctx = getAudioContext();
  if (!ctx) {
    playVibrationFallback();
    return;
  }

  if (ctx.state === 'suspended') {
    void ctx
      .resume()
      .then(() => {
        isAudioUnlocked = true;
        scheduleAlarm(ctx);
      })
      .catch(() => {
        // If browser blocks autoplay, still notify on mobile.
        playVibrationFallback();
      });
    return;
  }

  scheduleAlarm(ctx);
}

export function installAudioUnlock(): void {
  if (audioUnlockInstalled) {
    return;
  }
  audioUnlockInstalled = true;

  const unlockHandler = () => {
    primeAlarmAudio();
    if (!isAudioUnlocked) {
      return;
    }

    window.removeEventListener('pointerdown', unlockHandler, true);
    window.removeEventListener('touchstart', unlockHandler, true);
    window.removeEventListener('keydown', unlockHandler, true);
  };

  window.addEventListener('pointerdown', unlockHandler, {
    capture: true,
    passive: true,
  });
  window.addEventListener('touchstart', unlockHandler, {
    capture: true,
    passive: true,
  });
  window.addEventListener('keydown', unlockHandler, {
    capture: true,
    passive: true,
  });
}
