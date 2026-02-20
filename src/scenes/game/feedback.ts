import Phaser from 'phaser';

export type HitStopOpts = {
  /** Real time duration (ms). */
  ms?: number;
  /** Time scale during the stop. 1 = normal. */
  scale?: number;
};

type HitStopState = {
  timer: number | null;
  prevTimeScale: number;
  prevTweensScale: number;
  prevPhysicsScale: number;
};

const stateByScene = new WeakMap<Phaser.Scene, HitStopState>();

function getOrInit(scene: Phaser.Scene): HitStopState {
  let s = stateByScene.get(scene);
  if (!s) {
    const timeScale = scene.time.timeScale;
    const tweensScale = scene.tweens.timeScale;
    const physicsScale = (scene.physics?.world as Phaser.Physics.Arcade.World | undefined)?.timeScale ?? 1;
    s = { timer: null, prevTimeScale: timeScale, prevTweensScale: tweensScale, prevPhysicsScale: physicsScale };
    stateByScene.set(scene, s);
  }
  return s;
}

function applyTimeScale(scene: Phaser.Scene, scale: number) {
  scene.time.timeScale = scale;
  scene.tweens.timeScale = scale;
  const world = scene.physics?.world as Phaser.Physics.Arcade.World | undefined;
  if (world) world.timeScale = scale;
}

/**
 * A tiny "hit stop" using timeScale. Uses real-time setTimeout for restoration
 * so the stop duration doesn't stretch when timeScale is reduced.
 */
export function hitStop(scene: Phaser.Scene, opts: HitStopOpts = {}) {
  const ms = opts.ms ?? 80;
  const scale = Phaser.Math.Clamp(opts.scale ?? 0.15, 0.01, 1);

  const s = getOrInit(scene);

  // Overlap-safe: extend/replace the current stop.
  if (s.timer) {
    window.clearTimeout(s.timer);
    s.timer = null;
  } else {
    // Save baselines only when entering the stop.
    s.prevTimeScale = scene.time.timeScale;
    s.prevTweensScale = scene.tweens.timeScale;
    s.prevPhysicsScale = (scene.physics?.world as Phaser.Physics.Arcade.World | undefined)?.timeScale ?? 1;
  }

  applyTimeScale(scene, scale);

  s.timer = window.setTimeout(() => {
    // Scene might already be destroyed.
    if (!scene.sys || (scene.sys as any).isDestroyed?.()) return;

    applyTimeScale(scene, s.prevTimeScale);
    // Ensure we restore tweens/physics too even if they diverged.
    scene.tweens.timeScale = s.prevTweensScale;
    const world = scene.physics?.world as Phaser.Physics.Arcade.World | undefined;
    if (world) world.timeScale = s.prevPhysicsScale;

    s.timer = null;
  }, ms);
}

export type ShakePreset = 'slip' | 'winN' | 'winR' | 'winSR' | 'winSSR';

const shakePresets: Record<ShakePreset, { dur: number; intensity: number }> = {
  slip: { dur: 80, intensity: 0.004 },
  winN: { dur: 60, intensity: 0.002 },
  winR: { dur: 90, intensity: 0.004 },
  winSR: { dur: 150, intensity: 0.006 },
  winSSR: { dur: 320, intensity: 0.01 },
};

export function shake(scene: Phaser.Scene, preset: ShakePreset) {
  const cam = scene.cameras?.main;
  if (!cam) return;

  const p = shakePresets[preset];
  // Cap intensity to avoid nausea.
  const intensity = Phaser.Math.Clamp(p.intensity, 0, 0.012);
  cam.shake(p.dur, intensity);
}
