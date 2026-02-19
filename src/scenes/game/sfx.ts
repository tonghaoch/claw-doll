import Phaser from 'phaser';
import type { DollDef } from '../../data';

// Lightweight WebAudio-based SFX (arcade vibe)
export class Sfx {
  private ctx?: AudioContext;
  private lastMoveAt = 0;

  private scene: Phaser.Scene;
  private isEnabled: () => boolean;
  private getNowMs: () => number;

  // master volume (keep conservative; mobile speakers are harsh)
  constructor(scene: Phaser.Scene, isEnabled: () => boolean, getNowMs: () => number) {
    this.scene = scene;
    this.isEnabled = isEnabled;
    this.getNowMs = getNowMs;
  }

  private ensureCtx() {
    if (this.ctx) return this.ctx;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.ctx;
  }

  /** Call on any user gesture to unlock audio on iOS/Safari. */
  unlock() {
    if (!this.isEnabled()) return;
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  private vibrate(pattern: number | number[]) {
    try {
      if (!this.isEnabled()) return;
      const vib = (navigator as any).vibrate as undefined | ((p: any) => boolean);
      vib?.(pattern);
    } catch {
      // ignore
    }
  }

  private tone(freq: number, ms: number, type: OscillatorType, gain: number) {
    if (!this.isEnabled()) return;
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.02);
  }

  /** Very short filtered noise burst (helps sound like a "hit" instead of a pure beep). */
  private noise(ms: number, gain: number, hpFreq = 900) {
    if (!this.isEnabled()) return;
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const sampleRate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(sampleRate * (ms / 1000)));
    const buf = ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);

    // Decaying noise
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, 3);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(hpFreq, ctx.currentTime);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);

    src.connect(hp);
    hp.connect(g);
    g.connect(ctx.destination);

    src.start();
    src.stop(ctx.currentTime + ms / 1000 + 0.02);
  }

  /* ── Public SFX events ─────────────────────────────────── */

  move() {
    const now = this.getNowMs();
    if (now - this.lastMoveAt < 90) return;
    this.lastMoveAt = now;
    this.tone(220, 30, 'square', 0.018);
  }

  drop() {
    // whoosh + click
    this.noise(26, 0.03, 1200);
    this.tone(240, 24, 'square', 0.018);
    this.scene.time.delayedCall(25, () => this.tone(160, 70, 'square', 0.028));
  }

  clack(def?: DollDef) {
    // Metallic clack = bright noise + two pitched knocks.
    const isRare = def?.rarity === 'SR' || def?.rarity === 'SSR';
    const base = isRare ? 460 : 380;

    this.noise(22, isRare ? 0.055 : 0.045, 1600);
    this.tone(base, 22, 'square', isRare ? 0.050 : 0.045);
    this.scene.time.delayedCall(16, () => this.tone(base * 0.62, 38, 'square', 0.030));
  }

  fail() {
    // click + downward thunk
    this.noise(20, 0.03, 1100);
    this.tone(180, 35, 'sawtooth', 0.018);
    this.scene.time.delayedCall(30, () => this.tone(130, 90, 'sawtooth', 0.03));
  }

  win(def: DollDef) {
    if (def.rarity === 'SSR') {
      this.tone(880, 120, 'square', 0.055);
      this.scene.time.delayedCall(90, () => this.tone(1320, 140, 'square', 0.045));
      this.vibrate([8, 20, 8]);
      return;
    }
    if (def.rarity === 'SR') {
      this.tone(660, 90, 'square', 0.045);
      this.scene.time.delayedCall(70, () => this.tone(990, 110, 'square', 0.038));
      // SR: no vibrate by default (avoid feeling spammy)
      return;
    }
    if (def.rarity === 'R') {
      this.tone(520, 80, 'square', 0.038);
      return;
    }
    this.tone(420, 70, 'square', 0.032);
  }

  ssrArp() {
    const notes = [1047, 1319, 1568, 2093];
    notes.forEach((freq, i) => {
      this.scene.time.delayedCall(i * 80, () => this.tone(freq, 100, 'square', 0.038));
    });
  }

  start() {
    this.tone(440, 80, 'square', 0.038);
    this.scene.time.delayedCall(80, () => this.tone(660, 80, 'square', 0.038));
    this.scene.time.delayedCall(160, () => this.tone(880, 120, 'square', 0.045));
  }

  openPokedex() {
    this.tone(600, 60, 'square', 0.028);
    this.scene.time.delayedCall(60, () => this.tone(900, 80, 'square', 0.028));
  }

  closePokedex() {
    this.tone(900, 60, 'square', 0.028);
    this.scene.time.delayedCall(60, () => this.tone(600, 80, 'square', 0.028));
  }

  roundOver() {
    this.tone(440, 120, 'sawtooth', 0.038);
    this.scene.time.delayedCall(140, () => this.tone(330, 160, 'sawtooth', 0.038));
    this.scene.time.delayedCall(320, () => this.tone(220, 200, 'sawtooth', 0.03));
  }

  retry() {
    this.tone(330, 70, 'square', 0.038);
    this.scene.time.delayedCall(80, () => this.tone(440, 70, 'square', 0.038));
    this.scene.time.delayedCall(160, () => this.tone(660, 100, 'square', 0.045));
  }

  btnHover() {
    this.tone(700, 25, 'square', 0.014);
  }

  btnClick() {
    this.tone(500, 40, 'square', 0.028);
  }
}
