let audioCtx: AudioContext | null = null;
let audioUnlockInstalled = false;
let isAudioUnlocked = false;
let unlockInFlight: Promise<void> | null = null;
let fallbackAudio: HTMLAudioElement | null = null;
let fallbackAudioUnlocked = false;
let fallbackUnlockInFlight: Promise<void> | null = null;
let fallbackWavUrl: string | null = null;
let fallbackRunId = 0;
let fallbackIsPlaying = false;

const FALLBACK_REPEAT_COUNT = 4;
const FALLBACK_REPEAT_GAP_MS = 180;

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

function isLikelyIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isContextBlocked(ctx: AudioContext): boolean {
  const state = ctx.state as string;
  return state === 'suspended' || state === 'interrupted';
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
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

async function unlockAudioContext(ctx: AudioContext): Promise<void> {
  if (isContextBlocked(ctx)) {
    await ctx.resume();
  }
  playSilentUnlockPulse(ctx);
  isAudioUnlocked = ctx.state === 'running';
}

function createFallbackWavUrl(): string {
  if (fallbackWavUrl) {
    return fallbackWavUrl;
  }

  const sampleRate = 44100;
  const durationSec = 0.22;
  const sampleCount = Math.floor(sampleRate * durationSec);
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = sampleCount * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / (sampleRate * 0.015));
    const release = Math.max(0, 1 - i / sampleCount);
    const envelope = attack * release;
    const tone = Math.sin(2 * Math.PI * 880 * t) * 0.75 + Math.sin(2 * Math.PI * 660 * t) * 0.25;
    const sample = Math.max(-1, Math.min(1, tone * 0.42 * envelope));
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }

  fallbackWavUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  return fallbackWavUrl;
}

function getFallbackAudio(): HTMLAudioElement | null {
  if (!fallbackAudio) {
    fallbackAudio = new Audio(createFallbackWavUrl());
    fallbackAudio.preload = 'auto';
    fallbackAudio.setAttribute('playsinline', 'true');
  }
  return fallbackAudio;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForAudioEnd(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const fallbackTimeoutMs = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration * 1000 + 80
      : 420;

    const finish = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener('ended', finish);
      clearTimeout(timeoutId);
      resolve();
    };

    const timeoutId = window.setTimeout(finish, fallbackTimeoutMs);
    audio.addEventListener('ended', finish, { once: true });
  });
}

async function playFallbackAlarmSequence(): Promise<void> {
  const audio = getFallbackAudio();
  if (!audio) {
    playVibrationFallback();
    return;
  }

  if (fallbackIsPlaying) {
    return;
  }
  fallbackIsPlaying = true;

  const runId = ++fallbackRunId;
  let playedAtLeastOnce = false;

  try {
    for (let i = 0; i < FALLBACK_REPEAT_COUNT; i++) {
      if (runId !== fallbackRunId) {
        break;
      }

      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;

      try {
        await audio.play();
        playedAtLeastOnce = true;
      } catch {
        if (!playedAtLeastOnce) {
          playVibrationFallback();
        }
        break;
      }

      await waitForAudioEnd(audio);

      if (i < FALLBACK_REPEAT_COUNT - 1 && runId === fallbackRunId) {
        await waitMs(FALLBACK_REPEAT_GAP_MS);
      }
    }
  } finally {
    if (runId === fallbackRunId) {
      fallbackIsPlaying = false;
      audio.pause();
      audio.currentTime = 0;
    }
  }
}

function stopFallbackAlarmPlayback(): void {
  fallbackRunId += 1;
  fallbackIsPlaying = false;

  if (fallbackAudio) {
    fallbackAudio.pause();
    fallbackAudio.currentTime = 0;
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(0);
  }
}

function primeFallbackAudio(): void {
  const audio = getFallbackAudio();
  if (!audio || fallbackAudioUnlocked || fallbackUnlockInFlight) {
    return;
  }

  const originalVolume = audio.volume;
  audio.volume = 0;

  fallbackUnlockInFlight = audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      fallbackAudioUnlocked = true;
    })
    .catch(() => {
      // Ignore unlock failures; retry on next gesture.
    })
    .finally(() => {
      audio.volume = originalVolume;
      fallbackUnlockInFlight = null;
    });
}

function playVibrationFallback(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([140, 90, 140, 90, 220]);
  }
}

export function primeAlarmAudio(): void {
  const ctx = getAudioContext();

  if (ctx && !isAudioUnlocked && !unlockInFlight) {
    unlockInFlight = unlockAudioContext(ctx)
      .catch(() => {
        // Ignore resume errors; we'll retry on the next gesture.
      })
      .finally(() => {
        unlockInFlight = null;
      });
  }

  primeFallbackAudio();
}

export function playAlarm(): void {
  if (isLikelyIOS()) {
    void playFallbackAlarmSequence();
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    void playFallbackAlarmSequence();
    return;
  }

  if (isContextBlocked(ctx)) {
    void ctx
      .resume()
      .then(() => {
        isAudioUnlocked = true;
        scheduleAlarm(ctx);
      })
      .catch(() => {
        void playFallbackAlarmSequence();
      });
    return;
  }

  scheduleAlarm(ctx);
}

export function stopAlarm(): void {
  stopFallbackAlarmPlayback();

  if (audioCtx && audioCtx.state === 'running') {
    void audioCtx.suspend().catch(() => {
      // Ignore suspend errors.
    });
  }
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
    window.removeEventListener('pointerup', unlockHandler, true);
    window.removeEventListener('click', unlockHandler, true);
    window.removeEventListener('touchstart', unlockHandler, true);
    window.removeEventListener('touchend', unlockHandler, true);
    window.removeEventListener('keydown', unlockHandler, true);
  };

  window.addEventListener('pointerdown', unlockHandler, {
    capture: true,
    passive: true,
  });
  window.addEventListener('pointerup', unlockHandler, {
    capture: true,
    passive: true,
  });
  window.addEventListener('click', unlockHandler, {
    capture: true,
    passive: true,
  });
  window.addEventListener('touchstart', unlockHandler, {
    capture: true,
    passive: true,
  });
  window.addEventListener('touchend', unlockHandler, {
    capture: true,
    passive: true,
  });
  window.addEventListener('keydown', unlockHandler, {
    capture: true,
    passive: true,
  });
}
