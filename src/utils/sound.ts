let audioCtx: AudioContext | null = null;

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
  gain: 0.12,
  waveType: 'sine',
};

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
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

export function primeAlarmAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      // Ignore resume errors; we'll retry when playback is requested.
    });
  }
}

export function playAlarm(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    void ctx
      .resume()
      .then(() => {
        scheduleAlarm(ctx);
      })
      .catch(() => {
        // If browser blocks autoplay, fail silently.
      });
    return;
  }

  scheduleAlarm(ctx);
}
