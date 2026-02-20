import Phaser from 'phaser';
import { DOLLS, rarityColor, rarityLabel } from '../data';
import type { DollDef } from '../data';
import { loadSave, saveNow, clearSave, newSave } from '../save';
import { T, UI_FONT } from './game/theme';
import { getDebugFlags } from './game/debug';
import { findGrabCandidate } from './game/grab';
import { Sfx } from './game/sfx';
import { hitStop, shake } from './game/feedback';

type DollSprite = Phaser.Physics.Arcade.Image & { def: DollDef };

type ClawState = 'idle' | 'dropping' | 'grabbing' | 'rising';

type TouchDir = -1 | 0 | 1;

type BuffId =
  | 'SteadyHands'
  | 'SlowDrop'
  | 'SlipShield'
  | 'LuckyStart'
  | 'GreedyGrip'
  | 'PityBooster';

type BuffDef = {
  id: BuffId;
  name: string;
  desc: string;
};

const BUFF_MILESTONES = [3, 6, 9] as const;

const BUFF_POOL: BuffDef[] = [
  { id: 'SteadyHands', name: 'Steady Hands', desc: 'Move speed +20% (this run).' },
  { id: 'SlowDrop', name: 'Slow Drop', desc: 'Drop speed -15% (this run).' },
  { id: 'SlipShield', name: 'Slip Shield', desc: 'First slip becomes a guaranteed success.' },
  { id: 'LuckyStart', name: 'Lucky Start', desc: 'Start with +6% Luck, but Luck cap -5%.' },
  { id: 'GreedyGrip', name: 'Greedy Grip', desc: 'Grab window +12%, but effective chance -3%.' },
  { id: 'PityBooster', name: 'Pity Booster', desc: 'Fail gives extra +2% Luck (this run).' },
];

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;

  private box!: Phaser.GameObjects.Rectangle;
  private dolls!: Phaser.Physics.Arcade.Group;

  private clawX = 480;
  private clawTopY = 70;
  private clawMaxY = 390;
  private clawY = 70;

  private clawBody!: Phaser.GameObjects.Image;
  private clawArms!: Phaser.GameObjects.Image;
  private clawString!: Phaser.GameObjects.Rectangle;
  private clawShadow!: Phaser.GameObjects.Ellipse;
  private aimLine!: Phaser.GameObjects.Graphics;

  // Tiny visual weight feedback on grab/win/slip.
  private clawPunchY = 0;

  private luckBarFill!: Phaser.GameObjects.Rectangle;

  private flash!: Phaser.GameObjects.Rectangle;

  private state: ClawState = 'idle';
  private grabbed?: DollSprite;
  private grabPauseUntil = 0;

  private started = false;
  private startOverlay!: Phaser.GameObjects.Container;

  // Touch controls (mobile)
  private touchDir: TouchDir = 0;
  private touchPointerId: number | null = null;
  private touchDownAt = 0;
  private touchDownX = 0;
  private touchDownY = 0;

  // SFX
  private sfxEnabled = true;
  private sfx!: Sfx;

  // Hotbar
  private hotbarIcons: Phaser.GameObjects.Image[] = [];
  private hotbarSlots: Phaser.GameObjects.Rectangle[] = [];
  private hotbarSelectedBorder!: Phaser.GameObjects.Rectangle;
  private hotbarSlotGlow?: Phaser.GameObjects.Rectangle;

  // Round loop
  private baseAttemptsPerRound = 10;
  private attemptsPerRound = this.baseAttemptsPerRound;
  private attemptsLeft = this.attemptsPerRound;
  private roundNew = new Set<string>();
  private roundOverlay?: Phaser.GameObjects.Container;

  // Run (roguelite-lite)
  private buffOverlay?: Phaser.GameObjects.Container;
  private runDanger = 0;
  private runBuffs: BuffId[] = [];
  private buffChoicesTaken = 0;
  private slipShieldUsed = false;
  private runLuckCapDelta = 0; // modifies max luck
  private runGrabScale = 1;
  private runChancePenalty = 0; // subtract from effective chance
  private runPityExtra = 0; // add to luck gain on fail

  // Aim target highlight
  private aimed?: DollSprite;
  private aimedPulse?: Phaser.Tweens.Tween;

  private luckBonus = 0; // 0..0.4
  private failStreak = 0;
  private winStreak = 0;

  private hudText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private bgBlobs: Phaser.GameObjects.Image[] = [];
  private sfxLabel!: Phaser.GameObjects.Text;
  private dollShadows = new Map<DollSprite, Phaser.GameObjects.Ellipse>();

  private save = loadSave();
  private coinsAtRoundStart = 0;

  // Enable by opening the game with: ?debugGrab=1
  private debugGrab = false;
  private dropDebugHitShown = false;
  private grabDebugGfx?: Phaser.GameObjects.Graphics;

  constructor() {
    super('game');
  }

  create() {
    this.save = loadSave();
    this.coinsAtRoundStart = this.save.coins ?? 0;

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyP = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.keyR = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyM = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    this.sfxEnabled = localStorage.getItem('claw-doll-sfx') !== 'off';

    this.sfx = new Sfx(this, () => this.sfxEnabled, () => this.time.now);

    // Unlock audio on first user gesture (iOS/Safari needs this).
    this.input.once('pointerdown', () => this.sfx.unlock());
    this.input.once('pointerup', () => this.sfx.unlock());

    this.debugGrab = getDebugFlags(window.location.search).debugGrab;

    this.drawScene();
    this.spawnDolls();

    // HUD glass card
    const hudCard = this.add.graphics().setDepth(9);
    hudCard.fillStyle(T.shadow, T.shadowAlpha);
    hudCard.fillRoundedRect(14, 13, 440, 46, T.r);
    hudCard.fillStyle(T.cardBg, T.cardAlpha);
    hudCard.fillRoundedRect(12, 10, 440, 46, T.r);
    hudCard.lineStyle(1, T.border, T.borderAlpha);
    hudCard.strokeRoundedRect(12, 10, 440, 46, T.r);

    // Luck bar (modern rounded)
    const luckBg = this.add.graphics().setDepth(10);
    luckBg.fillStyle(0x4a3055, 1);
    luckBg.fillRoundedRect(16, 44, 200, 8, 4);
    this.luckBarFill = this.add.rectangle(16, 48, 0, 6, 0x66bb6a, 1).setOrigin(0, 0.5).setDepth(11);

    this.toastText = this.add
      .text(480, 40, '', {
        fontFamily: UI_FONT,
        fontStyle: 'bold',
        fontSize: '20px',
        color: '#f1f5f9',
        align: 'center',
        shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,0.4)', blur: 6, fill: true },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.hudText = this.add
      .text(24, 22, '', {
        fontFamily: UI_FONT,
        fontStyle: '600',
        fontSize: '14px',
        color: '#e2e8f0',
        shadow: { offsetX: 0, offsetY: 1, color: 'rgba(0,0,0,0.3)', blur: 3, fill: true },
      })
      .setDepth(10);

    this.updateHud();

    this.createHotbar();
    this.updateHotbar();

    this.events.on('resume', () => this.sfx.closePokedex());

    this.createStartOverlay();
    this.setupTouchControls();
  }

  update(_t: number, dtMs: number) {
    // Soft parallax drift on background blobs
    const t = _t * 0.001;
    for (let i = 0; i < this.bgBlobs.length; i++) {
      const blob = this.bgBlobs[i];
      const speed = 0.08 + i * 0.03;
      const phase = i * 1.8;
      blob.x += Math.sin(t * speed + phase) * 0.12;
      blob.y += Math.cos(t * speed * 0.7 + phase) * 0.08;
    }
    const dt = dtMs / 1000;

    // Start gate
    if (!this.started) {
      if (Phaser.Input.Keyboard.JustDown(this.keyM)) this.toggleMute();
      if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
        this.started = true;
        this.startOverlay.setVisible(false);
        this.startRound();
        this.sfx.start();
        this.showToast('←/→ Move · Space Drop · P Pokédex · R Reset · M Mute', 2000, '#e5e7eb');
      }
      return;
    }

    if (this.roundOverlay || this.buffOverlay) {
      if (Phaser.Input.Keyboard.JustDown(this.keyM)) this.toggleMute();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyM)) this.toggleMute();

    if (Phaser.Input.Keyboard.JustDown(this.keyP)) {
      this.sfx.openPokedex();
      this.scene.launch('pokedex', { save: this.save });
      this.scene.pause();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      clearSave();
      this.save = newSave();
      saveNow(this.save);
      this.showToast('Reset done', 1200, '#94a3b8');
      this.updateHud();
      this.updateHotbar();
    }

    this.updateDolls(dt);
    this.updateClaw(dt);
  }

  private setupTouchControls() {
    // Touch scheme:
    // - Hold left half: move left
    // - Hold right half: move right
    // - Tap anywhere: drop
    const halfW = () => this.scale.width / 2;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // only track the first active pointer
      if (this.touchPointerId !== null) return;
      this.touchPointerId = p.id;
      this.touchDownAt = this.time.now;
      this.touchDownX = p.x;
      this.touchDownY = p.y;
      this.touchDir = p.x < halfW() ? -1 : 1;

      // Unlock audio on any gesture (additional safety)
      this.sfx.unlock();

      // Start the game with a tap
      if (!this.started) {
        this.started = true;
        this.startOverlay.setVisible(false);
        this.startRound();
        this.sfx.start();
        this.showToast('Hold left/right · Tap drop · P Pokédex · M Mute', 2000, '#e5e7eb');
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.touchPointerId !== p.id) return;

      // Tap-to-drop: quick release with minimal movement.
      const dt = this.time.now - this.touchDownAt;
      const dx = p.x - this.touchDownX;
      const dy = p.y - this.touchDownY;
      const dist2 = dx * dx + dy * dy;

      const isTap = dt < 220 && dist2 < 12 * 12;
      if (isTap) this.handleDropAction();

      this.touchPointerId = null;
      this.touchDir = 0;
    });

    this.input.on('pointercancel', (p: Phaser.Input.Pointer) => {
      if (this.touchPointerId !== p.id) return;
      this.touchPointerId = null;
      this.touchDir = 0;
    });
  }

  private handleDropAction() {
    if (!this.started) return;
    if (this.roundOverlay) return;
    if (this.state !== 'idle') return;
    if (this.attemptsLeft <= 0) return;

    this.attemptsLeft -= 1;
    this.updateHud();
    this.sfx.drop();

    this.state = 'dropping';
    this.grabbed = undefined;
    this.dropDebugHitShown = false;
    this.clawArms.setTexture('claw-arms-open');
  }

  private drawScene() {
    const w = 960;
    const h = 540;

    // Multi-stop gradient background (warm sunset)
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0xf7c59f, 0xf0a87e, 0xf0917a, 0xe87e8a, 1, 1, 1, 1);
    bg.fillRect(0, 0, w, Math.ceil(h * 0.45));
    bg.fillGradientStyle(0xf0917a, 0xe87e8a, 0xc06a8e, 0x8a4f7d, 1, 1, 1, 1);
    bg.fillRect(0, Math.floor(h * 0.45), w, Math.ceil(h * 0.3));
    bg.fillGradientStyle(0x8a4f7d, 0x7a4572, 0x4a3055, 0x3b2240, 1, 1, 1, 1);
    bg.fillRect(0, Math.floor(h * 0.75), w, Math.ceil(h * 0.25) + 1);

    // Subtle warm colour wash
    const grad = this.add.graphics().setDepth(0);
    grad.fillGradientStyle(0xffb347, 0xff8c69, 0x2ec4b6, 0xf06292, 0.07, 0.07, 0.07, 0.07);
    grad.fillRect(0, 0, w, h);

    // Soft colour blobs (ambient atmosphere with slow parallax)
    this.bgBlobs = [];
    const blobDefs = [
      { x: 160, y: 120, scale: 2.2, tint: 0xffa07a, alpha: 0.12 },
      { x: 780, y: 100, scale: 1.8, tint: 0xffcc80, alpha: 0.10 },
      { x: 480, y: 420, scale: 2.5, tint: 0x2ec4b6, alpha: 0.08 },
      { x: 120, y: 440, scale: 1.6, tint: 0xf48fb1, alpha: 0.08 },
      { x: 820, y: 380, scale: 2.0, tint: 0xff8a65, alpha: 0.07 },
    ];
    for (const bd of blobDefs) {
      const blob = this.add.image(bd.x, bd.y, 'bg-blob')
        .setScale(bd.scale).setAlpha(bd.alpha).setTint(bd.tint).setDepth(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.bgBlobs.push(blob);
    }

    // Vignette + grain overlays
    this.add.image(w / 2, h / 2, 'vignette').setDepth(1);
    this.add.image(w / 2, h / 2, 'grain').setDepth(1).setAlpha(0.35);

    // Animated dust particles
    this.time.addEvent({ delay: 900, loop: true, callback: () => this.spawnDust() });

    // box — modern glass arcade container
    const boxX = 160;
    const boxY = 140;
    const boxW = 640;
    const boxH = 320;

    // Outer frame with subtle depth
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x3a2245, 1);
    g.fillRoundedRect(boxX - 10, boxY - 10, boxW + 20, boxH + 20, T.r);
    // Inner fill — slightly lighter than background for doll readability
    g.fillStyle(0x2e1a34, 0.95);
    g.fillRoundedRect(boxX, boxY, boxW, boxH, T.rSm);
    // Outer border (darker, heavier)
    g.lineStyle(2.5, 0x6b5570, 0.7);
    g.strokeRoundedRect(boxX - 10, boxY - 10, boxW + 20, boxH + 20, T.r);
    // Inner border
    g.lineStyle(1.5, T.border, 0.45);
    g.strokeRoundedRect(boxX, boxY, boxW, boxH, T.rSm);
    // Inner inset line (glass edge)
    g.lineStyle(1, T.glass, 0.14);
    g.strokeRoundedRect(boxX + 2, boxY + 2, boxW - 4, boxH - 4, 8);

    // Glass reflection highlight (top)
    const sh = this.add.graphics().setDepth(6);
    sh.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.10, 0.10, 0, 0);
    sh.fillRect(boxX + 8, boxY + 4, boxW - 16, 18);
    // Diagonal reflection streak
    sh.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.05, 0, 0, 0.05);
    sh.fillRect(boxX + 40, boxY + 6, 120, 8);
    // Bottom inner shadow
    sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.14, 0.14);
    sh.fillRect(boxX + 6, boxY + boxH - 28, boxW - 12, 24);

    // Bottom filler layer inside box (gradient + subtle noise)
    const filler = this.add.graphics().setDepth(3);
    const fillerH = 60;
    filler.fillGradientStyle(0x4a3055, 0x4a3055, 0x3b2240, 0x3b2240, 0, 0, 0.35, 0.35);
    filler.fillRect(boxX + 4, boxY + boxH - fillerH, boxW - 8, fillerH);
    // Subtle noise using spark textures
    for (let i = 0; i < 18; i++) {
      const nx = Phaser.Math.Between(boxX + 10, boxX + boxW - 10);
      const ny = Phaser.Math.Between(boxY + boxH - fillerH + 5, boxY + boxH - 8);
      this.add.image(nx, ny, 'spark').setScale(Phaser.Math.FloatBetween(0.4, 0.8))
        .setAlpha(Phaser.Math.FloatBetween(0.02, 0.06)).setDepth(3).setTint(0x6b5060);
    }

    this.box = this.add.rectangle(boxX, boxY, boxW, boxH, 0x000000, 0).setOrigin(0);

    // claw
    this.clawX = boxX + boxW / 2;
    this.clawTopY = 70;
    this.clawY = this.clawTopY;

    this.clawString = this.add.rectangle(this.clawX, this.clawTopY, 2, 1, 0x5a6670).setOrigin(0.5, 0).setDepth(7);
    this.clawBody = this.add.image(this.clawX, this.clawTopY + 18, 'claw-body').setOrigin(0.5, 0.5).setDepth(7);
    this.clawArms = this.add.image(this.clawX, this.clawTopY + 32, 'claw-arms-open').setOrigin(0.5, 0).setDepth(7);

    // Claw drop shadow for contrast on warm backgrounds
    this.clawShadow = this.add.ellipse(this.clawX, this.clawTopY + 38, 32, 10, 0x000000, 0.30).setDepth(6);

    this.clawMaxY = boxY + boxH - 20;

    // Aiming preview line (idle only)
    this.aimLine = this.add.graphics().setDepth(3);

    // SSR flash overlay (hidden by default)
    this.flash = this.add.rectangle(0, 0, w, h, 0xffffff, 0).setOrigin(0).setDepth(50);
  }

  private spawnDolls() {
    this.dolls = this.physics.add.group();

    const { x, y, width, height } = this.box;

    for (let i = 0; i < 12; i++) {
      const def = Phaser.Utils.Array.GetRandom(DOLLS);
      const px = Phaser.Math.Between(x + 40, x + width - 40);
      // Bias spawn towards bottom half
      const py = Phaser.Math.Between(y + height * 0.35, y + height - 40);
      const spr = this.physics.add
        .image(px, py, def.assetKey)
        .setScale(0.6)
        .setBounce(1, 1)
        .setCollideWorldBounds(false) as DollSprite;

      spr.def = def;
      spr.setDepth(5);
      spr.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-25, 25));
      this.dolls.add(spr);

      // Shadow ellipse under doll
      const shadow = this.add.ellipse(px, py + 14, 28, 8, 0x000000, 0.22).setDepth(4);
      this.dollShadows.set(spr, shadow);
    }
  }

  private updateDolls(dt: number) {
    const { x, y, width, height } = this.box;
    const dangerMul = Phaser.Math.Clamp(1 + this.runDanger * 0.04, 1, 1.7);

    this.dolls.children.iterate((obj) => {
      const spr = obj as DollSprite;
      if (!spr?.active) return true;
      if (spr === this.grabbed) return true;
      const body = spr.body as Phaser.Physics.Arcade.Body;

      // Soft bounds bounce inside the box
      const left = x + 24;
      const right = x + width - 24;
      const top = y + 24;
      const bottom = y + height - 24;

      if (spr.x < left) {
        spr.x = left;
        body.velocity.x = Math.abs(body.velocity.x);
      } else if (spr.x > right) {
        spr.x = right;
        body.velocity.x = -Math.abs(body.velocity.x);
      }

      if (spr.y < top) {
        spr.y = top;
        body.velocity.y = Math.abs(body.velocity.y);
      } else if (spr.y > bottom) {
        spr.y = bottom;
        body.velocity.y = -Math.abs(body.velocity.y);
      }

      // Mild drift to keep motion alive
      body.velocity.x += Phaser.Math.FloatBetween(-5, 5) * dt;
      body.velocity.y += Phaser.Math.FloatBetween(-5, 5) * dt;

      body.velocity.x = Phaser.Math.Clamp(body.velocity.x, -60 * dangerMul, 60 * dangerMul);
      body.velocity.y = Phaser.Math.Clamp(body.velocity.y, -45 * dangerMul, 45 * dangerMul);

      // Update shadow position
      const shadow = this.dollShadows.get(spr);
      if (shadow) {
        shadow.setPosition(spr.x, spr.y + 14);
      }

      return true;
    });
  }

  private updateClaw(dt: number) {
    const speed = 220 * (this.hasBuff('SteadyHands') ? 1.2 : 1);
    const boxLeft = this.box.x + 30;
    const boxRight = this.box.x + this.box.width - 30;

    if (this.state === 'idle') {
      const touchHoldMs = this.time.now - this.touchDownAt;
      const allowTouchMove = this.touchPointerId !== null && touchHoldMs > 120;

      const moved = !!(
        this.cursors.left?.isDown ||
        this.cursors.right?.isDown ||
        (allowTouchMove && this.touchDir !== 0)
      );

      if (this.cursors.left?.isDown || (allowTouchMove && this.touchDir === -1)) this.clawX -= speed * dt;
      if (this.cursors.right?.isDown || (allowTouchMove && this.touchDir === 1)) this.clawX += speed * dt;
      if (moved) this.sfx.move();

      this.clawX = Phaser.Math.Clamp(this.clawX, boxLeft, boxRight);

      // Aim line + target highlight
      this.drawAimLine();
      this.aimLine.setVisible(true);
      this.updateAimedTarget();

      if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
        this.handleDropAction();
      }
    } else {
      this.aimLine.setVisible(false);
      this.clearAimedTarget();
    }

    const dropSpeed = 360 * (this.hasBuff('SlowDrop') ? 0.85 : 1);
    const riseSpeed = 420;

    if (this.state === 'dropping') {
      this.clawY += dropSpeed * dt;

      // Try to grab as soon as we touch a doll (feels responsive and matches player expectation).
      // If nothing is hit, we will attempt once at max depth.
      const hit = this.findGrabCandidate();
      if (hit) {
        if (this.debugGrab && !this.dropDebugHitShown) {
          this.dropDebugHitShown = true;
          this.showToast(`HIT: ${hit.def.name}`, 800, '#22c55e');
        }
        this.state = 'grabbing';
        this.tryGrab(hit);
      } else if (this.clawY >= this.clawMaxY) {
        this.clawY = this.clawMaxY;
        this.state = 'grabbing';
        this.tryGrab();
      }
    } else if (this.state === 'grabbing') {
      // short pause for feedback
      if (this.time.now < this.grabPauseUntil) {
        // Hold for a tiny beat so the clack/feedback reads as "weight".
      } else {
        this.clawArms.setTexture('claw-arms-closed');
        this.state = 'rising';
      }
    } else if (this.state === 'rising') {
      this.clawY -= riseSpeed * dt;
      if (this.grabbed) {
        this.grabbed.x = this.clawX;
        this.grabbed.y = this.clawY + 44;
      }
      if (this.clawY <= this.clawTopY) {
        this.clawY = this.clawTopY;
        this.state = 'idle';
        this.finishGrab();
      }
    }

    // render claw parts
    const py = this.clawPunchY;
    this.clawString.setPosition(this.clawX, this.clawTopY);
    this.clawString.height = Math.max(1, this.clawY - this.clawTopY + py);
    this.clawBody.setPosition(this.clawX, this.clawY + 18 + py);
    this.clawArms.setPosition(this.clawX, this.clawY + 28 + py);
    this.clawShadow.setPosition(this.clawX, this.clawY + 38 + py);
  }

  private findGrabCandidate(): DollSprite | undefined {
    return findGrabCandidate({
      clawX: this.clawX,
      clawY: this.clawY,
      dolls: this.dolls,
      debugGrab: this.debugGrab,
      grabDebugGfx: this.grabDebugGfx,
      add: this.add,
      grabScale: this.runGrabScale,
    });
  }

  private hasBuff(id: BuffId) {
    return this.runBuffs.includes(id);
  }

  private pityGain() {
    // Base pity + permanent upgrade + run buff.
    return 0.04 + (this.save.upgrades.pityPlusLv ?? 0) * 0.005 + this.runPityExtra;
  }

  private punchClaw(strength = 1) {
    const s = Phaser.Math.Clamp(strength, 0.6, 1.8);
    // Kill any existing punch tween implicitly by tweening the same target.
    const obj = { v: this.clawPunchY };
    this.tweens.add({
      targets: obj,
      v: { from: 0, to: 6 * s },
      duration: 70,
      ease: 'Sine.easeOut',
      yoyo: true,
      hold: 30,
      onUpdate: () => (this.clawPunchY = obj.v),
      onComplete: () => (this.clawPunchY = 0),
    });
  }

  private tryGrab(forced?: DollSprite) {
    const best = forced ?? this.findGrabCandidate();

    if (!best) {
      this.onFail('没抓到');
      return;
    }

    // A tiny pause makes the grab feel "mechanical" (arcade clack).
    this.grabPauseUntil = this.time.now + 90;
    this.sfx.clack(best.def);
    this.punchClaw(1);

    // Success check with pity/luck bonus
    const dangerPenalty = this.runDanger * 0.01;
    const chance = Phaser.Math.Clamp(best.def.catchRate + this.luckBonus - dangerPenalty - this.runChancePenalty, 0, 0.95);
    const roll = Math.random();

    if (this.debugGrab) {
      const msg = `GRAB? ${best.def.name} chance=${chance.toFixed(2)} roll=${roll.toFixed(2)}`;
      this.showToast(msg, 900, '#60a5fa');
      // Also log to console for desktop debugging.
      // eslint-disable-next-line no-console
      console.log('[grab]', { name: best.def.name, chance, roll, luckBonus: this.luckBonus, catchRate: best.def.catchRate });
    }

    const shield = this.hasBuff('SlipShield') && !this.slipShieldUsed;
    if (roll <= chance || shield) {
      if (shield && roll > chance) {
        this.slipShieldUsed = true;
        this.showToast('Slip Shield!', 800, '#a78bfa');
      }
      // Grab it
      best.setVelocity(0, 0);
      const body = best.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
      best.setDepth(8);
      this.grabbed = best;

      // Let the clack land before the jingle.
      this.time.delayedCall(70, () => {
        hitStop(this, { ms: 70, scale: 0.18 });
        this.onWin(best.def);
      });
    } else {
      // Slip feedback: clamp it briefly then let it fall back.
      // slip sequence (brief attach then release)
      this.time.delayedCall(60, () => this.sfx.fail());
      best.setVelocity(0, 0);
      const body = best.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
      this.grabbed = best;

      hitStop(this, { ms: 90, scale: 0.16 });
      shake(this, 'slip');
      this.punchClaw(1.4);
      this.showToast(`滑了！${best.def.name}`, 900, '#6b7280');

      // Release soon so finishGrab() won't remove it.
      this.time.delayedCall(120, () => {
        if (!this.grabbed || this.grabbed !== best) return;
        const b = best.body as Phaser.Physics.Arcade.Body;
        b.enable = true;
        // push it back into the box
        best.setVelocity(Phaser.Math.Between(-90, 90), Phaser.Math.Between(60, 140));
        this.grabbed = undefined;
        // released
        this.clawArms.setTexture('claw-arms-open');
      });

      this.failStreak += 1;
      this.winStreak = 0;
      this.luckBonus = Phaser.Math.Clamp(this.luckBonus + this.pityGain(), 0, 0.35 + this.runLuckCapDelta);
      this.updateHud();

      this.afterAttemptResolved('slip');
    }
  }

  private finishGrab() {
    if (this.grabbed) {
      // Remove grabbed doll from scene and respawn another
      const old = this.grabbed;
      const oldShadow = this.dollShadows.get(old);
      if (oldShadow) { oldShadow.destroy(); this.dollShadows.delete(old); }
      old.destroy();
      this.grabbed = undefined;

      // Respawn 1 doll to keep density
      const def = Phaser.Utils.Array.GetRandom(DOLLS);
      const { x, y, width, height } = this.box;
      const px = Phaser.Math.Between(x + 40, x + width - 40);
      const py = Phaser.Math.Between(y + height * 0.35, y + height - 40);
      const spr = this.physics.add
        .image(px, py, def.assetKey)
        .setScale(0.6)
        .setBounce(1, 1)
        .setCollideWorldBounds(false) as DollSprite;
      spr.def = def;
      spr.setDepth(5);
      spr.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-25, 25));
      this.dolls.add(spr);

      const shadow = this.add.ellipse(px, py + 14, 28, 8, 0x000000, 0.22).setDepth(4);
      this.dollShadows.set(spr, shadow);
    }

    this.clawArms.setTexture('claw-arms-open');

    if (this.attemptsLeft <= 0) {
      this.showRoundEndOverlay();
    }
  }

  private onWin(def: DollDef) {
    this.failStreak = 0;
    this.winStreak += 1;
    this.save.bestStreak = Math.max(this.save.bestStreak, this.winStreak);

    this.luckBonus = 0;

    const prev = this.save.counts[def.id] ?? 0;
    this.save.counts[def.id] = prev + 1;
    const isNew = prev === 0;
    if (isNew) this.roundNew.add(def.id);

    // Coins: duplicates still feel good.
    const baseCoins = def.rarity === 'SSR' ? 60 : def.rarity === 'SR' ? 25 : def.rarity === 'R' ? 12 : 5;
    const newBonus = isNew ? 10 : 0;
    this.save.coins = (this.save.coins ?? 0) + baseCoins + newBonus;

    // Update recent list for hotbar
    this.save.recent = [def.id, ...(this.save.recent ?? []).filter((x) => x !== def.id)].slice(0, 9);
    saveNow(this.save);

    // Celebrate by rarity
    const fx = {
      N: { sparks: 4, shake: 0.002, dur: 60, flash: 0, chunks: 3, chunkSpread: 22, ringSize: 30 },
      R: { sparks: 6, shake: 0.004, dur: 90, flash: 0, chunks: 6, chunkSpread: 32, ringSize: 40 },
      SR: { sparks: 10, shake: 0.006, dur: 150, flash: 0, chunks: 12, chunkSpread: 44, ringSize: 60 },
      SSR: { sparks: 16, shake: 0.010, dur: 300, flash: 0.55, chunks: 20, chunkSpread: 58, ringSize: 80 },
    } as const;
    const f = fx[def.rarity];

    // Time + camera feedback (A-style: light slow-down, not full freeze)
    if (def.rarity === 'SSR') hitStop(this, { ms: 120, scale: 0.12 });
    else if (def.rarity === 'SR') hitStop(this, { ms: 95, scale: 0.14 });
    else if (def.rarity === 'R') hitStop(this, { ms: 75, scale: 0.16 });
    else hitStop(this, { ms: 60, scale: 0.18 });

    if (def.rarity === 'SSR') shake(this, 'winSSR');
    else if (def.rarity === 'SR') shake(this, 'winSR');
    else if (def.rarity === 'R') shake(this, 'winR');
    else shake(this, 'winN');

    this.punchClaw(def.rarity === 'SSR' ? 1.6 : def.rarity === 'SR' ? 1.35 : def.rarity === 'R' ? 1.15 : 1);
    this.spawnSpark(this.clawX, this.clawY + 44, f.sparks, 28, def.color);
    this.spawnPixelChunks(this.clawX, this.clawY + 44, f.chunks, f.chunkSpread, def.color);

    // Ring burst colored by rarity
    const rarityHex = Phaser.Display.Color.HexStringToColor(rarityColor[def.rarity]).color;
    this.spawnRingBurst(this.clawX, this.clawY + 44, f.ringSize, rarityHex);

    if (f.flash > 0) {
      // SSR: colorful screen tint instead of white
      this.flash.setFillStyle(0xff6e40, 1);
      this.flash.setAlpha(f.flash * 0.6);
      this.tweens.add({
        targets: this.flash,
        alpha: 0,
        duration: 500,
        ease: 'Sine.easeOut',
      });
    }

    // SSR rising arpeggio beeps
    if (def.rarity === 'SSR') {
      this.sfx.ssrArp();
    }

    this.showToast(`Got! [${rarityLabel(def.rarity)}] ${def.name}`, 1200, rarityColor[def.rarity]);

    this.sfx.win(def);
    this.animatePickupToHotbar(def);
    this.updateHotbar();
    this.updateHud();

    // Luck bar drain
    this.tweens.add({
      targets: this.luckBarFill,
      width: 0,
      duration: T.fast,
      ease: T.ease,
    });

    this.afterAttemptResolved('win');
  }

  private onFail(msg: string) {
    this.failStreak += 1;
    this.winStreak = 0;

    // Pity/luck increases slowly, capped
    this.luckBonus = Phaser.Math.Clamp(this.luckBonus + this.pityGain(), 0, 0.35 + this.runLuckCapDelta);

    this.showToast(msg, 900, '#6b7280');
    this.updateHud();

    this.afterAttemptResolved('fail');
  }

  private updateHud() {
    const owned = Object.values(this.save.counts).filter((n) => n > 0).length;
    const total = DOLLS.length;
    const luckPct = Math.round(this.luckBonus * 100);

    this.hudText.setText(
      `Pokédex ${owned}/${total}  ·  Try ${this.attemptsLeft}/${this.attemptsPerRound}  ·  Luck +${luckPct}%  ·  Danger ${this.runDanger}  ·  Coins ${this.save.coins ?? 0}`,
    );

    // luck bar
    const max = Phaser.Math.Clamp(0.35 + this.runLuckCapDelta, 0.15, 0.5);
    const fullW = 200;
    const ratio = Phaser.Math.Clamp(this.luckBonus / max, 0, 1);
    this.luckBarFill.width = Math.max(0, Math.round(fullW * ratio));
    // green -> yellow near max
    this.luckBarFill.fillColor = this.luckBonus > 0.25 ? 0xffb347 : 0x66bb6a;
  }

  private createStartOverlay() {
    this.started = false;

    const panel = this.add.graphics();
    panel.fillStyle(0x2a1a2e, 0.50);
    panel.fillRect(0, 0, 960, 540);

    const card = this.add.graphics();
    const x = 240;
    const y = 140;
    const w = 480;
    const h = 260;
    card.fillStyle(T.shadow, T.shadowAlpha);
    card.fillRoundedRect(x + 3, y + 4, w, h, T.r);
    card.fillStyle(T.cardBg, 0.96);
    card.fillRoundedRect(x, y, w, h, T.r);
    card.lineStyle(1, T.border, T.borderAlpha);
    card.strokeRoundedRect(x, y, w, h, T.r);

    const title = this.add.text(480, 185, 'Claw Doll', {
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      fontSize: '36px',
      color: '#f1f5f9',
      shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,0.3)', blur: 4, fill: true },
    }).setOrigin(0.5);

    const subtitle = this.add.text(480, 225, 'Collect adorable dolls with the claw', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const how = this.add.text(480, 270, '←/→ move    Space drop\nTap drop · Hold left/right to move\nP pokédex    R reset    M mute', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: '#cbd5e1',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);

    // Primary button style
    const btnGfx = this.add.graphics();
    btnGfx.fillStyle(0xffb347, 1);
    btnGfx.fillRoundedRect(400, 330, 160, 44, 22);
    const start = this.add.text(480, 352, 'Tap / Space', {
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      fontSize: '16px',
      color: '#2a1a2e',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: start,
      alpha: { from: 0.35, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.startOverlay = this.add.container(0, 0, [panel, card, title, subtitle, how, btnGfx, start]).setDepth(100);
    this.startOverlay.setAlpha(0);
    this.tweens.add({
      targets: this.startOverlay,
      alpha: 1,
      y: { from: 8, to: 0 },
      duration: T.slow,
      ease: T.ease,
    });
  }

  private startRound() {
    this.coinsAtRoundStart = this.save.coins ?? 0;

    // Permanent upgrades (light power, capped)
    const attemptsPlus = this.save.upgrades.attemptsPlusLv ?? 0; // capped in save load
    this.attemptsPerRound = this.baseAttemptsPerRound + attemptsPlus;
    this.attemptsLeft = this.attemptsPerRound;

    this.roundNew = new Set();
    this.winStreak = 0;
    this.failStreak = 0;

    // Reset run state
    this.runDanger = 0;
    this.runBuffs = [];
    this.buffChoicesTaken = 0;
    this.slipShieldUsed = false;
    this.runLuckCapDelta = 0;
    this.runGrabScale = 1;
    this.runChancePenalty = 0;
    this.runPityExtra = 0;

    // Start luck from permanent upgrade
    const startLuck = (this.save.upgrades.startLuckLv ?? 0) * 0.02;
    this.luckBonus = Phaser.Math.Clamp(startLuck, 0, 0.35);

    if (this.roundOverlay) {
      this.roundOverlay.destroy(true);
      this.roundOverlay = undefined;
    }

    this.updateHud();
  }

  private showRoundEndOverlay() {
    if (this.roundOverlay) return;

    // Freeze input by forcing idle and ignoring update loop via started gate not used; simplest is keep started=true but block drops
    this.state = 'idle';
    this.clearAimedTarget();

    const panel = this.add.graphics();
    panel.fillStyle(0x2a1a2e, 0.82);
    panel.fillRect(0, 0, 960, 540);

    const card = this.add.graphics();
    card.fillStyle(T.shadow, T.shadowAlpha);
    card.fillRoundedRect(243, 134, 480, 300, T.r);
    card.fillStyle(T.cardBg, 0.96);
    card.fillRoundedRect(240, 130, 480, 300, T.r);
    card.lineStyle(1, T.border, T.borderAlpha);
    card.strokeRoundedRect(240, 130, 480, 300, T.r);

    const newCount = this.roundNew.size;
    const title = this.add.text(480, 178, 'Round Over', {
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      fontSize: '28px',
      color: '#f1f5f9',
      shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,0.3)', blur: 4, fill: true },
    }).setOrigin(0.5);
    const coinsGained = (this.save.coins ?? 0) - (this.coinsAtRoundStart ?? 0);
    const summary = this.add
      .text(480, 220, `New: ${newCount}  ·  Coins +${coinsGained}  ·  Danger ${this.runDanger}  ·  Buffs ${this.runBuffs.length}/3`, {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: '#cbd5e1',
        align: 'center',
      })
      .setOrigin(0.5);

    // Simple upgrade shop (permanent, light)
    const overlayObjs: Phaser.GameObjects.GameObject[] = [];

    const coinsText = this.add
      .text(480, 255, `Coins: ${this.save.coins ?? 0}`, {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
    overlayObjs.push(coinsText);

    const costs = {
      startLuck: (lv: number) => 40 * (lv + 1),
      attempts: (lv: number) => 120 * (lv + 1),
      pity: (lv: number) => 60 * (lv + 1),
    };

    const upgradeLines: { key: keyof typeof costs; label: string; cap: number; y: number }[] = [
      { key: 'startLuck', label: 'Start Luck', cap: 5, y: 282 },
      { key: 'attempts', label: 'Extra Tries', cap: 2, y: 304 },
      { key: 'pity', label: 'Pity Gain', cap: 4, y: 326 },
    ];

    const upgradeTextObjs: Phaser.GameObjects.Text[] = [];
    const refreshUpgrades = () => {
      coinsText.setText(`Coins: ${this.save.coins ?? 0}`);
      for (let i = 0; i < upgradeLines.length; i++) {
        const u = upgradeLines[i];
        const lv = u.key === 'startLuck'
          ? (this.save.upgrades.startLuckLv ?? 0)
          : u.key === 'attempts'
            ? (this.save.upgrades.attemptsPlusLv ?? 0)
            : (this.save.upgrades.pityPlusLv ?? 0);
        const cap = u.cap;
        const cost = costs[u.key](lv);
        const can = lv < cap && (this.save.coins ?? 0) >= cost;
        const done = lv >= cap;
        const suffix = done ? 'MAX' : `Lv ${lv}/${cap}  ·  Cost ${cost}`;
        upgradeTextObjs[i].setText(`${u.label}: ${suffix}`);
        upgradeTextObjs[i].setStyle({ color: done ? '#475569' : can ? '#e2e8f0' : '#94a3b8' });
      }
    };

    for (const u of upgradeLines) {
      const t = this.add
        .text(480, u.y, '', {
          fontFamily: UI_FONT,
          fontSize: '13px',
          color: '#94a3b8',
        })
        .setOrigin(0.5);
      const hit = this.add.rectangle(240, u.y - 10, 480, 20, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.sfx.btnHover());
      hit.on('pointerup', () => {
        const lv = u.key === 'startLuck'
          ? (this.save.upgrades.startLuckLv ?? 0)
          : u.key === 'attempts'
            ? (this.save.upgrades.attemptsPlusLv ?? 0)
            : (this.save.upgrades.pityPlusLv ?? 0);
        if (lv >= u.cap) return;
        const cost = costs[u.key](lv);
        if ((this.save.coins ?? 0) < cost) return;

        this.save.coins -= cost;
        if (u.key === 'startLuck') this.save.upgrades.startLuckLv = lv + 1;
        if (u.key === 'attempts') this.save.upgrades.attemptsPlusLv = lv + 1;
        if (u.key === 'pity') this.save.upgrades.pityPlusLv = lv + 1;
        saveNow(this.save);
        this.sfx.btnClick();
        refreshUpgrades();
      });

      upgradeTextObjs.push(t);
      overlayObjs.push(hit, t);
    }

    refreshUpgrades();

    // Primary button
    const btnGfx = this.add.graphics();
    btnGfx.fillStyle(0xffb347, 1);
    btnGfx.fillRoundedRect(400, 360, 160, 44, 22);
    const hint = this.add
      .text(480, 382, 'Tap / Space / Enter', {
        fontFamily: UI_FONT,
        fontStyle: 'bold',
        fontSize: '16px',
        color: '#2a1a2e',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: { from: 0.35, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.roundOverlay = this.add.container(0, 0, [panel, card, title, summary, ...overlayObjs, btnGfx, hint]).setDepth(120);
    this.roundOverlay.setAlpha(0);
    this.tweens.add({
      targets: this.roundOverlay,
      alpha: 1,
      y: { from: 8, to: 0 },
      duration: T.med,
      ease: T.ease,
    });
    this.sfx.roundOver();

    const retry = () => {
      if (!this.roundOverlay) return;
      this.roundOverlay.destroy(true);
      this.roundOverlay = undefined;
      this.sfx.retry();
      this.startRound();
    };

    // Tap-to-retry
    const hit = this.add
      .rectangle(400, 360, 160, 44, 0x000000, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => retry());

    // Also allow tapping anywhere on the dark panel to continue.
    panel.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 540), Phaser.Geom.Rectangle.Contains);
    panel.on('pointerup', () => retry());

    // One-shot key handler
    this.input.keyboard!.once('keydown-SPACE', retry);
    this.input.keyboard!.once('keydown-ENTER', retry);

    this.roundOverlay.add(hit);
  }

  private afterAttemptResolved(outcome: 'win' | 'fail' | 'slip') {
    // Challenge curve: difficulty grows as the run progresses.
    this.runDanger += outcome === 'win' ? 2 : 1;
    this.runDanger = Phaser.Math.Clamp(this.runDanger, 0, 12);

    const used = this.attemptsPerRound - this.attemptsLeft;
    const idx = (BUFF_MILESTONES as readonly number[]).indexOf(used);
    if (idx >= 0 && this.buffChoicesTaken <= idx && !this.buffOverlay && !this.roundOverlay) {
      // Delay a bit so the player can see the win/fail feedback first.
      this.time.delayedCall(650, () => {
        if (this.buffOverlay || this.roundOverlay) return;
        this.showBuffChoiceOverlay();
      });
    }
  }

  private applyBuff(buff: BuffId) {
    if (this.runBuffs.includes(buff)) return;

    this.runBuffs.push(buff);

    if (buff === 'LuckyStart') {
      this.runLuckCapDelta -= 0.05;
      this.luckBonus = Phaser.Math.Clamp(this.luckBonus + 0.06, 0, 0.35 + this.runLuckCapDelta);
    }

    if (buff === 'GreedyGrip') {
      this.runGrabScale = Phaser.Math.Clamp(this.runGrabScale * 1.12, 0.8, 1.4);
      this.runChancePenalty += 0.03;
    }

    if (buff === 'PityBooster') {
      this.runPityExtra += 0.02;
    }

    // SlipShield effect is checked during grab resolution.

    this.updateHud();
  }

  private showBuffChoiceOverlay() {
    if (this.buffOverlay) return;

    // Choose 3 distinct buffs, prefer ones not owned.
    const owned = new Set(this.runBuffs);
    const pool = BUFF_POOL.filter((b) => !owned.has(b.id));
    const src = pool.length >= 3 ? pool : BUFF_POOL;

    const picks: BuffDef[] = [];
    const bag = [...src];
    while (picks.length < 3 && bag.length > 0) {
      const i = Phaser.Math.Between(0, bag.length - 1);
      picks.push(bag.splice(i, 1)[0]);
    }

    const panel = this.add.graphics();
    panel.fillStyle(0x0b0f1a, 0.75);
    panel.fillRect(0, 0, 960, 540);

    const title = this.add.text(480, 120, 'Choose 1 Upgrade', {
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      fontSize: '26px',
      color: '#f1f5f9',
    }).setOrigin(0.5);

    const sub = this.add.text(480, 155, `Pick ${this.buffChoicesTaken + 1}/3`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const cards: Phaser.GameObjects.GameObject[] = [];
    const x0 = 140;
    const y0 = 210;
    const cw = 220;
    const ch = 240;
    const gap = 30;

    const choose = (id: BuffId) => {
      this.buffChoicesTaken += 1;
      this.applyBuff(id);
      if (this.buffOverlay) {
        this.buffOverlay.destroy(true);
        this.buffOverlay = undefined;
      }
      this.sfx.btnClick();
    };

    for (let k = 0; k < picks.length; k++) {
      const b = picks[k];
      const x = x0 + k * (cw + gap);
      const y = y0;

      const g = this.add.graphics();
      g.fillStyle(T.cardBg, 0.96);
      g.fillRoundedRect(x, y, cw, ch, T.r);
      g.lineStyle(1, T.border, T.borderAlpha);
      g.strokeRoundedRect(x, y, cw, ch, T.r);

      const name = this.add.text(x + cw / 2, y + 48, b.name, {
        fontFamily: UI_FONT,
        fontStyle: 'bold',
        fontSize: '18px',
        color: '#e2e8f0',
        align: 'center',
      }).setOrigin(0.5);

      const desc = this.add.text(x + 18, y + 86, b.desc, {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: '#cbd5e1',
        wordWrap: { width: cw - 36 },
        lineSpacing: 6,
      }).setOrigin(0, 0);

      const btn = this.add.rectangle(x, y, cw, ch, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => this.sfx.btnHover());
      btn.on('pointerup', () => choose(b.id));

      cards.push(g, name, desc, btn);
    }

    // Block clicks on background.
    panel.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 540), Phaser.Geom.Rectangle.Contains);

    this.buffOverlay = this.add.container(0, 0, [panel, title, sub, ...cards]).setDepth(130);
    this.buffOverlay.setAlpha(0);
    this.tweens.add({ targets: this.buffOverlay, alpha: 1, duration: 160, ease: 'Sine.easeOut' });
  }

  private updateAimedTarget() {
    // Find best target near aim line
    const clawRect = new Phaser.Geom.Rectangle(this.clawX - 28, this.box.y + 20, 56, this.box.height - 40);

    let best: DollSprite | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    this.dolls.children.iterate((obj) => {
      const spr = obj as DollSprite;
      if (!spr?.active) return true;
      if (spr === this.grabbed) return true;

      const r = spr.getBounds();
      if (!Phaser.Geom.Intersects.RectangleToRectangle(clawRect, r)) return true;

      const score = Math.abs(spr.x - this.clawX) + Math.abs(spr.y - (this.box.y + this.box.height / 2)) * 0.15;
      if (score < bestScore) {
        bestScore = score;
        best = spr;
      }
      return true;
    });

    if (best === this.aimed) return;

    this.clearAimedTarget();
    if (!best) return;

    this.aimed = best;
    this.aimed.setTint(0xffffff);
    this.aimed.setScale(0.66);

    this.aimedPulse = this.tweens.add({
      targets: this.aimed,
      alpha: { from: 0.75, to: 1 },
      duration: 360,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private clearAimedTarget() {
    if (this.aimedPulse) {
      this.aimedPulse.stop();
      this.aimedPulse = undefined;
    }
    if (this.aimed && this.aimed.active) {
      this.aimed.clearTint();
      this.aimed.setAlpha(1);
      this.aimed.setScale(0.6);
    }
    this.aimed = undefined;
  }

  private showToast(text: string, ms: number, color: string = '#e5e7eb') {
    this.toastText.setText(text);
    this.toastText.setStyle({ color });
    this.toastText.setAlpha(1);
    this.toastText.setScale(1);
    this.toastText.setY(48);

    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      y: { from: 30, to: 40 },
      alpha: { from: 0, to: 1 },
      scale: { from: 0.92, to: 1 },
      duration: T.med,
      ease: T.ease,
    });
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      y: 36,
      delay: ms,
      duration: T.slow,
      ease: T.easeIn,
    });
  }

  private spawnSpark(x: number, y: number, count = 6, spread = 26, tint?: number) {
    for (let i = 0; i < count; i++) {
      const s = this.add.image(x, y, 'spark').setScale(Phaser.Math.Between(2, 3));
      if (tint != null) s.setTint(tint);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(Math.round(spread * 0.5), spread);
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist;
      this.tweens.add({
        targets: s,
        x: tx,
        y: ty,
        alpha: 0,
        duration: 420,
        ease: 'Sine.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  private spawnDust() {
    const x = Phaser.Math.Between(40, 920);
    const y = Phaser.Math.Between(40, 500);

    // Tint: 70% warm white/ivory, 20% orange/amber, 10% red/pink
    const roll = Math.random();
    let tint: number;
    let alpha: number;
    if (roll < 0.7) {
      tint = Phaser.Utils.Array.GetRandom([0xfffdf0, 0xfff8e1, 0xfffaf0]);
      alpha = Phaser.Math.FloatBetween(0.01, 0.03);
    } else if (roll < 0.9) {
      tint = Phaser.Utils.Array.GetRandom([0xffcc80, 0xffa726, 0xffb74d]);
      alpha = Phaser.Math.FloatBetween(0.01, 0.03);
    } else {
      tint = Phaser.Utils.Array.GetRandom([0xef9a9a, 0xf48fb1, 0xe57373]);
      alpha = Phaser.Math.FloatBetween(0.008, 0.02);
    }

    const s = this.add
      .image(x, y, 'dust-dot')
      .setScale(Phaser.Math.FloatBetween(0.25, 0.6))
      .setAlpha(alpha)
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);

    this.tweens.add({
      targets: s,
      x: x + Phaser.Math.Between(-12, 12),
      y: y - Phaser.Math.Between(20, 50),
      alpha: 0,
      duration: Phaser.Math.Between(3500, 6500),
      ease: 'Sine.easeOut',
      onComplete: () => s.destroy(),
    });
  }

  private spawnPixelChunks(x: number, y: number, count: number, spread: number, color: number) {
    const palette = [color, 0xffffff, 0xfacc15, 0xff6b6b, 0x60a5fa];
    for (let i = 0; i < count; i++) {
      const c = palette[i % palette.length];
      const sz = Phaser.Math.Between(3, 6);
      const s = this.add.rectangle(x, y, sz, sz, c).setDepth(45);
      s.setRotation(Phaser.Math.FloatBetween(0, Math.PI));
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(Math.round(spread * 0.35), spread);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        rotation: s.rotation + Phaser.Math.FloatBetween(-1.5, 1.5),
        duration: Phaser.Math.Between(380, 600),
        ease: 'Sine.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  private spawnRingBurst(x: number, y: number, radius: number, color: number) {
    const ring = this.add.graphics().setDepth(46);
    const startR = 4;
    ring.lineStyle(3, color, 0.8);
    ring.strokeCircle(x, y, startR);
    const obj = { r: startR, a: 0.8 };
    this.tweens.add({
      targets: obj,
      r: radius,
      a: 0,
      duration: 400,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(Math.max(1, 3 - obj.r / radius * 2), color, obj.a);
        ring.strokeCircle(x, y, obj.r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  private drawAimLine() {
    this.aimLine.clear();
    this.aimLine.lineStyle(2, 0x94a3b8, 0.18);

    const startY = this.clawY + 44;
    const endY = this.clawMaxY;
    const dash = 10;
    const gap = 8;

    for (let y = startY; y < endY; y += dash + gap) {
      const y2 = Math.min(endY, y + dash);
      this.aimLine.lineBetween(this.clawX, y, this.clawX, y2);
    }
  }

  /** Hook for UI button hover — call when hover buttons are added. */
  playBtnHoverSfx() {
    this.sfx.btnHover();
  }

  /** Hook for UI button click — call when click buttons are added. */
  playBtnClickSfx() {
    this.sfx.btnClick();
  }

  private toggleMute() {
    this.sfxEnabled = !this.sfxEnabled;
    localStorage.setItem('claw-doll-sfx', this.sfxEnabled ? 'on' : 'off');
    this.showToast(this.sfxEnabled ? 'Sound on' : 'Sound off', 800, '#94a3b8');
    if (this.sfxLabel) {
      this.sfxLabel.setStyle({ color: this.sfxEnabled ? '#e2e8f0' : '#4b5563' });
    }
  }

  private createHotbar() {
    const cx = 480;
    const y = 510;
    const slots = 9;
    const size = 36;
    const pad = 6;
    const totalW = slots * size + (slots - 1) * pad + 20;
    const x0 = cx - totalW / 2;

    const bgGfx = this.add.graphics().setDepth(30);
    bgGfx.fillStyle(T.shadow, T.shadowAlpha);
    bgGfx.fillRoundedRect(cx - totalW / 2 + 2, y - 28 + 3, totalW, 56, T.rPill);
    bgGfx.fillStyle(T.cardBg, T.cardAlpha);
    bgGfx.fillRoundedRect(cx - totalW / 2, y - 28, totalW, 56, T.rPill);
    bgGfx.lineStyle(1, T.border, T.borderAlpha);
    bgGfx.strokeRoundedRect(cx - totalW / 2, y - 28, totalW, 56, T.rPill);

    const icons: Phaser.GameObjects.Image[] = [];
    const slotImgs: Phaser.GameObjects.Rectangle[] = [];

    for (let i = 0; i < slots; i++) {
      const sx = x0 + 10 + i * (size + pad);
      const sy = y - size / 2;
      const slotGfx = this.add.graphics().setDepth(31);
      slotGfx.fillStyle(T.bgMid, 0.85);
      slotGfx.fillRoundedRect(sx, sy - size / 2, size, size, T.rSm);
      slotGfx.lineStyle(1, T.border, T.borderAlpha);
      slotGfx.strokeRoundedRect(sx, sy - size / 2, size, size, T.rSm);
      // Keep reference as image placeholder (use a small rect for tint animation)
      const slotImg = this.add.rectangle(sx + size / 2, sy, size - 2, size - 2, 0x3b2240, 0)
        .setDepth(31);
      slotImgs.push(slotImg);

      const icon = this.add.image(sx + size / 2, sy, 'spark').setDepth(32).setVisible(false);
      icons.push(icon);

      // selected highlight (first slot) — pulsing border
      if (i === 0) {
        this.hotbarSelectedBorder = this.add.rectangle(sx + size / 2, sy, size + 4, size + 4)
          .setDepth(33).setStrokeStyle(2, 0xffb347, 1);
        this.tweens.add({
          targets: this.hotbarSelectedBorder,
          alpha: { from: 0.45, to: 1 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.hotbarSlotGlow = this.add.rectangle(sx + size / 2, sy, size + 8, size + 8, 0xffb347, 0)
          .setDepth(30);
      }
    }

    const hint = this.add
      .text(cx, y - 42, 'Recent', {
        fontFamily: UI_FONT,
        fontStyle: '600',
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setDepth(34);

    // Key hints near hotbar
    const keyHints = this.add
      .text(cx, y + 34, '←/→ Move · Space Drop · P Pokédex · R Reset', {
        fontFamily: UI_FONT,
        fontSize: '11px',
        color: '#64748b',
      })
      .setOrigin(0.5)
      .setDepth(34);

    // SFX circle icon button
    const sfxCx = cx + totalW / 2 + 24;
    const sfxR = 18;
    const sfxBtnGfx = this.add.graphics().setDepth(34);
    const drawSfxBtn = (pressed = false) => {
      sfxBtnGfx.clear();
      sfxBtnGfx.fillStyle(T.cardBg, pressed ? 1 : 0.9);
      sfxBtnGfx.fillCircle(sfxCx, y, sfxR);
      sfxBtnGfx.lineStyle(1, T.border, T.borderAlpha);
      sfxBtnGfx.strokeCircle(sfxCx, y, sfxR);
    };
    drawSfxBtn();
    const sfxBtnBg = this.add.rectangle(sfxCx, y, sfxR * 2, sfxR * 2, 0x000000, 0)
      .setDepth(34);
    this.sfxLabel = this.add
      .text(sfxCx, y, '\u266b', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        color: this.sfxEnabled ? '#e2e8f0' : '#4b5563',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(35);
    sfxBtnBg.setInteractive({ useHandCursor: true });
    sfxBtnBg.on('pointerdown', () => {
      drawSfxBtn(true);
      this.toggleMute();
      this.playBtnClickSfx();
    });
    sfxBtnBg.on('pointerup', () => drawSfxBtn());
    sfxBtnBg.on('pointerover', () => {
      sfxBtnGfx.clear();
      sfxBtnGfx.fillStyle(0x1e293b, 1);
      sfxBtnGfx.fillCircle(sfxCx, y, sfxR);
      sfxBtnGfx.lineStyle(1.5, T.accent, 0.5);
      sfxBtnGfx.strokeCircle(sfxCx, y, sfxR);
      this.playBtnHoverSfx();
    });
    sfxBtnBg.on('pointerout', () => drawSfxBtn());

    this.add.container(0, 0, [bgGfx, hint, keyHints]).setDepth(30);
    this.hotbarIcons = icons;
    this.hotbarSlots = slotImgs;
  }

  private updateHotbar() {
    const ids = (this.save.recent ?? []).slice(0, 9);
    for (let i = 0; i < this.hotbarIcons.length; i++) {
      const icon = this.hotbarIcons[i];
      const id = ids[i];
      if (!id) {
        icon.setVisible(false);
        continue;
      }
      const def = DOLLS.find((d) => d.id === id);
      if (!def) {
        icon.setVisible(false);
        continue;
      }
      icon.setTexture(def.assetKey);
      icon.setScale(0.45);
      icon.setVisible(true);
    }
  }

  private animatePickupToHotbar(def: DollDef) {
    // Fly a small icon from claw to first hotbar slot
    if (!this.hotbarIcons?.[0]) return;
    const target = this.hotbarIcons[0];

    const icon = this.add.image(this.clawX, this.clawY + 44, def.assetKey).setScale(0.6).setDepth(200);
    icon.clearTint();

    this.tweens.add({
      targets: icon,
      x: target.x,
      y: target.y,
      scale: 0.45,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        icon.destroy();
        // pulse target
        target.setScale(0.50);
        this.tweens.add({
          targets: target,
          scale: 0.45,
          duration: 180,
          ease: 'Back.easeOut',
        });
        // Flash/glow the first slot on pickup arrival
        if (this.hotbarSlotGlow) {
          this.hotbarSlotGlow.setAlpha(0.6);
          this.tweens.add({
            targets: this.hotbarSlotGlow,
            alpha: 0,
            duration: 350,
            ease: 'Sine.easeOut',
          });
        }
        if (this.hotbarSlots[0]) {
          this.hotbarSlots[0].setFillStyle(0xfacc15, 0.3);
          this.time.delayedCall(250, () => {
            if (this.hotbarSlots[0]) this.hotbarSlots[0].setFillStyle(0x0f172a, 0);
          });
        }
      },
    });
  }
}

