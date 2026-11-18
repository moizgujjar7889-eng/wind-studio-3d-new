import type { WindEngineStatus } from './types';

type Listener = (wind: number, status: WindEngineStatus) => void;

/**
 * Microphone-driven wind engine.
 *
 * Converts blowing / whooshing noise picked up by the mic into a smoothed
 * wind value from 0 to 100. Blowing produces broadband noise with a rising
 * energy envelope — we detect that shape with a spectral-bandwatch filter
 * rather than raw volume so ambient room noise is largely ignored.
 */
export class WindEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Float32Array = new Float32Array(0);
  private timeData: Float32Array = new Float32Array(0);
  private raf = 0;
  private listener: Listener | null = null;

  private raw = 0;
  private smoothed = 0;
  private peakHold = 0;
  private phase: WindEngineStatus['phase'] = 'idle';
  private message: string | null = null;
  private noiseFloor = 0.02;
  private startedAt = 0;

  get current() {
    return this.smoothed;
  }

  get peak() {
    return this.peakHold;
  }

  get status(): WindEngineStatus {
    return { phase: this.phase, level: this.smoothed, peak: this.peakHold, message: this.message };
  }

  onWind(listener: Listener) {
    this.listener = listener;
  }

  async start() {
    if (this.phase === 'listening') return;
    this.message = null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.2;
      src.connect(this.analyser);
      this.freq = new Float32Array(this.analyser.frequencyBinCount);
      this.timeData = new Float32Array(this.analyser.fftSize);
      this.startedAt = performance.now();
      this.phase = 'listening';
      this.loop();
    } catch (err) {
      this.phase = 'error';
      const name = err instanceof Error ? err.name : '';
      this.message =
        name === 'NotAllowedError'
          ? 'Microphone access was blocked. Enable it in your browser settings to control the wind with your breath.'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'The microphone could not be started. Try again.';
      this.listener?.(0, this.status);
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.phase = 'idle';
    this.message = null;
    this.raw = 0;
    this.smoothed = 0;
    this.peakHold = 0;
    this.listener?.(0, this.status);
  }

  dispose() {
    this.stop();
    this.listener = null;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.analyser) return;

    const { fftSize } = this.analyser;
    this.analyser.getFloatFrequencyData(this.freq);
    this.analyser.getFloatTimeDomainData(this.timeData);

    // RMS from the time domain
    let sum = 0;
    for (let i = 0; i < fftSize; i++) sum += this.timeData[i] * this.timeData[i];
    const rms = Math.sqrt(sum / fftSize);

    // Spectral balance: blowing is broadband, voiced speech is tonal (peaked).
    // flatness across the spectrum => more "breath-like".
    let energy = 0;
    let logSum = 0;
    let bins = 0;
    const sampleRate = this.ctx?.sampleRate ?? 48000;
    const binHz = sampleRate / (fftSize * 2);
    for (let i = 2; i < this.freq.length; i++) {
      const hz = i * binHz;
      if (hz < 80 || hz > 6000) continue;
      const db = this.freq[i];
      const lin = Math.pow(10, db / 20);
      energy += lin * lin;
      if (lin > 1e-6) logSum += Math.log(lin * lin);
      bins++;
    }
    energy = Math.sqrt(energy / Math.max(1, bins));
    const logAvg = bins > 0 ? logSum / bins : 0;
    const flatness = energy > 1e-8 ? Math.min(1, Math.exp(logAvg) / energy) : 0;

    // Breath score: strong broadband energy in the mid-high band
    const loud = Math.max(0, rms - this.noiseFloor * 1.4);
    const breath = loud * (0.35 + 0.9 * flatness);

    // Slow noise-floor tracking so rooms adapt over time
    if (performance.now() - this.startedAt < 1200) {
      this.noiseFloor = Math.max(this.noiseFloor, rms * 0.7);
    } else {
      this.noiseFloor = Math.max(0.004, this.noiseFloor * 0.999 + rms * 0.001);
    }

    // Curve into 0..1 — slightly more sensitive so light blowing registers
    const shaped = Math.min(1, Math.pow(breath * 8.0, 0.58));
    this.raw = shaped;
    this.peakHold = Math.max(this.peakHold * 0.993, shaped);
    // Fast attack, slow release for gusty feel
    this.smoothed =
      shaped > this.smoothed
        ? this.smoothed + (shaped - this.smoothed) * 0.55
        : this.smoothed + (shaped - this.smoothed) * 0.065;

    this.listener?.(this.smoothed, this.status);
  };
}

/**
 * When the mic is off, drive the wind with a procedural gust cycle so the
 * scene still demonstrates the simulation.
 */
export class DemoWind {
  private value = 0;
  private t = Math.random() * 100;
  private raf = 0;
  private listener: Listener | null = null;

  onWind(listener: Listener) {
    this.listener = listener;
  }

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.t += 0.016;
      // layered sines => organic gusting between 15% and 85%
      const a = 0.5 + 0.28 * Math.sin(this.t * 0.55);
      const b = 0.5 + 0.18 * Math.sin(this.t * 1.7 + 1.3);
      const c = 0.5 + 0.1 * Math.sin(this.t * 3.9 + 4.1);
      this.value = Math.max(0, Math.min(1, (a * b * c) * 1.35));
      this.listener?.(this.value, {
        phase: 'listening',
        level: this.value,
        peak: Math.max(this.peak, this.value),
        message: null,
      });
    };
    this.raf = requestAnimationFrame(tick);
  }

  get peak() {
    return this.value;
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.value = 0;
  }
}
