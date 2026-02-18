import Phaser from 'phaser';
import { DOLLS, rarityColor, rarityLabel } from '../data';
import type { DollDef } from '../data';
import { loadSave, saveNow, clearSave, newSave } from '../save';

type DollSprite = Phaser.Physics.Arcade.Image & { def: DollDef };

type ClawState = 'idle' | 'dropping' | 'grabbing' | 'rising';

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;

  private box!: Phaser.GameObjects.Rectangle;
  private dolls!: Phaser.Physics.Arcade.Group;

  private clawX = 480;
  private clawTopY = 70;
  private clawMaxY = 390;
  private clawY = 70;

  private clawBody!: Phaser.GameObjects.Image;
  private clawArms!: Phaser.GameObjects.Image;
  private clawString!: Phaser.GameObjects.Rectangle;
  private aimLine!: Phaser.GameObjects.Graphics;

  private luckBarFill!: Phaser.GameObjects.Rectangle;

  private flash!: Phaser.GameObjects.Rectangle;

  private state: ClawState = 'idle';
  private grabbed?: DollSprite;

  private started = false;
  private startOverlay!: Phaser.GameObjects.Container;

  // SFX
  private sfxEnabled = true;
  private audio?: AudioContext;
  private lastMoveSfxAt = 0;

  // Hotbar
  private hotbarIcons: Phaser.GameObjects.Image[] = [];

  // Round loop
  private readonly attemptsPerRound = 10;
  private attemptsLeft = this.attemptsPerRound;
  private roundNew = new Set<string>();
  private roundOverlay?: Phaser.GameObjects.Container;

  // Aim target highlight
  private aimed?: DollSprite;
  private aimedPulse?: Phaser.Tweens.Tween;

  private luckBonus = 0; // 0..0.4
  private failStreak = 0;
  private winStreak = 0;

  private hudText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;

  private save = loadSave();

  constructor() {
    super('game');
  }

  create() {
    this.save = loadSave();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyP = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.keyR = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.drawScene();
    this.spawnDolls();

    // Minecraft-ish HUD panels (pixel border + dark fill)
    this.add.rectangle(12, 12, 420, 62, 0x0b1224, 0.85).setOrigin(0, 0).setDepth(9);
    this.add.rectangle(12, 12, 420, 62).setOrigin(0, 0).setStrokeStyle(2, 0x334155, 1).setDepth(9);

    // Luck bar (XP bar style)
    this.add.rectangle(16, 58, 200, 10, 0x111827, 1).setOrigin(0, 0.5).setDepth(10);
    this.add.rectangle(16, 58, 200, 10).setOrigin(0, 0.5).setStrokeStyle(2, 0x475569, 1).setDepth(12);
    this.luckBarFill = this.add.rectangle(16, 58, 0, 6, 0x22c55e, 1).setOrigin(0, 0.5).setDepth(11);

    this.toastText = this.add
      .text(480, 40, '', {
        fontFamily: '"Press Start 2P","Noto Sans SC",sans-serif',
        fontSize: '16px',
        color: '#e5e7eb',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.hudText = this.add
      .text(16, 16, '', {
        fontFamily: '"Press Start 2P","Noto Sans SC",sans-serif',
        fontSize: '14px',
        color: '#e5e7eb',
      })
      .setDepth(10);

    this.updateHud();

    this.createHotbar();
    this.updateHotbar();

    this.createStartOverlay();
    this.showToast('READY? PRESS SPACE', 1600, '#94a3b8');
  }

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000;

    // Start gate
    if (!this.started) {
      if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
        this.started = true;
        this.startOverlay.setVisible(false);
        this.startRound();
        this.showToast('←/→ MOVE  SPACE DROP  P POKEDEX  R RESET', 2000, '#e5e7eb');
      }
      return;
    }

    if (this.roundOverlay) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyP)) {
      this.scene.launch('pokedex', { save: this.save });
      this.scene.pause();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      clearSave();
      this.save = newSave();
      saveNow(this.save);
      this.showToast('RESET OK', 1200, '#94a3b8');
      this.updateHud();
      this.updateHotbar();
    }

    this.updateDolls(dt);
    this.updateClaw(dt);
  }

  private drawScene() {
    const w = 960;
    const h = 540;

    // background grid
    const bg = this.add.graphics();
    bg.fillStyle(0x0b1020, 1);
    bg.fillRect(0, 0, w, h);
    bg.lineStyle(1, 0x111827, 1);
    for (let x = 0; x < w; x += 24) bg.lineBetween(x, 0, x, h);
    for (let y = 0; y < h; y += 24) bg.lineBetween(0, y, w, y);

    // box
    const boxX = 160;
    const boxY = 140;
    const boxW = 640;
    const boxH = 320;

    const g = this.add.graphics();
    g.fillStyle(0x111827, 1);
    g.fillRoundedRect(boxX - 6, boxY - 6, boxW + 12, boxH + 12, 8);
    g.fillStyle(0x0f172a, 1);
    g.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    g.lineStyle(2, 0x334155, 1);
    g.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);

    this.box = this.add.rectangle(boxX, boxY, boxW, boxH, 0x000000, 0).setOrigin(0);

    // claw
    this.clawX = boxX + boxW / 2;
    this.clawTopY = 70;
    this.clawY = this.clawTopY;

    this.clawString = this.add.rectangle(this.clawX, this.clawTopY, 2, 1, 0x94a3b8).setOrigin(0.5, 0);
    this.clawBody = this.add.image(this.clawX, this.clawTopY + 18, 'claw-body').setOrigin(0.5, 0.5);
    this.clawArms = this.add.image(this.clawX, this.clawTopY + 32, 'claw-arms-open').setOrigin(0.5, 0);

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
      const py = Phaser.Math.Between(y + 60, y + height - 40);
      const spr = this.physics.add
        .image(px, py, 'dolls', def.frame)
        .setScale(2)
        .setBounce(1, 1)
        .setCollideWorldBounds(false) as DollSprite;

      spr.def = def;
      spr.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-25, 25));
      this.dolls.add(spr);
    }
  }

  private updateDolls(dt: number) {
    const { x, y, width, height } = this.box;

    this.dolls.children.iterate((obj) => {
      const spr = obj as DollSprite;
      if (!spr?.active) return true;
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

      body.velocity.x = Phaser.Math.Clamp(body.velocity.x, -60, 60);
      body.velocity.y = Phaser.Math.Clamp(body.velocity.y, -45, 45);

      return true;
    });
  }

  private updateClaw(dt: number) {
    const speed = 220;
    const boxLeft = this.box.x + 30;
    const boxRight = this.box.x + this.box.width - 30;

    if (this.state === 'idle') {
      const moved = !!(this.cursors.left?.isDown || this.cursors.right?.isDown);
      if (this.cursors.left?.isDown) this.clawX -= speed * dt;
      if (this.cursors.right?.isDown) this.clawX += speed * dt;
      if (moved) this.playMoveSfx();

      this.clawX = Phaser.Math.Clamp(this.clawX, boxLeft, boxRight);

      // Aim line + target highlight
      this.drawAimLine();
      this.aimLine.setVisible(true);
      this.updateAimedTarget();

      if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
        if (this.attemptsLeft <= 0) {
          this.showRoundEndOverlay();
          return;
        }
        this.attemptsLeft -= 1;
        this.updateHud();
        this.playDropSfx();

        this.state = 'dropping';
        this.grabbed = undefined;
        this.clawArms.setTexture('claw-arms-open');
      }
    } else {
      this.aimLine.setVisible(false);
      this.clearAimedTarget();
    }

    const dropSpeed = 360;
    const riseSpeed = 420;

    if (this.state === 'dropping') {
      this.clawY += dropSpeed * dt;
      if (this.clawY >= this.clawMaxY) {
        this.clawY = this.clawMaxY;
        this.state = 'grabbing';
        this.tryGrab();
      }
    } else if (this.state === 'grabbing') {
      // short pause for feedback
      this.clawArms.setTexture('claw-arms-closed');
      this.state = 'rising';
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
    this.clawString.setPosition(this.clawX, this.clawTopY);
    this.clawString.height = Math.max(1, this.clawY - this.clawTopY);
    this.clawBody.setPosition(this.clawX, this.clawY + 18);
    this.clawArms.setPosition(this.clawX, this.clawY + 28);
  }

  private tryGrab() {
    // Find nearest doll under claw arms area
    const clawRect = new Phaser.Geom.Rectangle(this.clawX - 28, this.clawY + 36, 56, 28);

    let best: DollSprite | undefined;
    let bestDist = Number.POSITIVE_INFINITY;

    this.dolls.children.iterate((obj) => {
      const spr = obj as DollSprite;
      if (!spr?.active) return true;

      const r = spr.getBounds();
      if (!Phaser.Geom.Intersects.RectangleToRectangle(clawRect, r)) return true;

      const d = Phaser.Math.Distance.Between(this.clawX, this.clawY, spr.x, spr.y);
      if (d < bestDist) {
        bestDist = d;
        best = spr;
      }
      return true;
    });

    if (!best) {
      this.onFail('没抓到');
      return;
    }

    // Success check with pity/luck bonus
    const chance = Phaser.Math.Clamp(best.def.catchRate + this.luckBonus, 0, 0.95);
    const roll = Math.random();

    if (roll <= chance) {
      // Grab it
      best.setVelocity(0, 0);
      const body = best.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
      this.grabbed = best;
      this.onWin(best.def);
    } else {
      // Slip feedback: clamp it briefly then let it fall back.
      // slip sequence (brief attach then release)
      this.playFailSfx();
      best.setVelocity(0, 0);
      const body = best.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
      this.grabbed = best;

      this.cameras.main.shake(70, 0.004);
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
      this.luckBonus = Phaser.Math.Clamp(this.luckBonus + 0.04, 0, 0.35);
      this.updateHud();
    }
  }

  private finishGrab() {
    if (this.grabbed) {
      // Remove grabbed doll from scene and respawn another
      const old = this.grabbed;
      old.destroy();
      this.grabbed = undefined;

      // Respawn 1 doll to keep density
      const def = Phaser.Utils.Array.GetRandom(DOLLS);
      const { x, y, width, height } = this.box;
      const px = Phaser.Math.Between(x + 40, x + width - 40);
      const py = Phaser.Math.Between(y + 60, y + height - 40);
      const spr = this.physics.add
        .image(px, py, 'dolls', def.frame)
        .setScale(2)
        .setBounce(1, 1)
        .setCollideWorldBounds(false) as DollSprite;
      spr.def = def;
      spr.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-25, 25));
      this.dolls.add(spr);
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

    this.save.counts[def.id] = (this.save.counts[def.id] ?? 0) + 1;
    this.roundNew.add(def.id);

    // Update recent list for hotbar
    this.save.recent = [def.id, ...(this.save.recent ?? []).filter((x) => x !== def.id)].slice(0, 9);
    saveNow(this.save);

    // Celebrate by rarity
    const fx = {
      N: { sparks: 4, shake: 0.002, dur: 60, flash: 0 },
      R: { sparks: 6, shake: 0.004, dur: 90, flash: 0 },
      SR: { sparks: 10, shake: 0.006, dur: 150, flash: 0 },
      SSR: { sparks: 16, shake: 0.010, dur: 300, flash: 0.55 },
    } as const;
    const f = fx[def.rarity];

    this.cameras.main.shake(f.dur, f.shake);
    this.spawnSpark(this.clawX, this.clawY + 44, f.sparks, 28, def.color);

    if (f.flash > 0) {
      this.flash.setAlpha(f.flash);
      this.tweens.add({
        targets: this.flash,
        alpha: 0,
        duration: 420,
        ease: 'Sine.easeOut',
      });
    }

    this.showToast(`GET! [${rarityLabel(def.rarity)}] ${def.name}`, 1200, rarityColor[def.rarity]);
    this.playWinSfx(def);
    this.animatePickupToHotbar(def);
    this.updateHotbar();
    this.updateHud();

    // Luck bar drain
    this.tweens.add({
      targets: this.luckBarFill,
      width: 0,
      duration: 180,
      ease: 'Sine.easeOut',
    });
  }

  private onFail(msg: string) {
    this.failStreak += 1;
    this.winStreak = 0;

    // Pity/luck increases slowly, capped
    this.luckBonus = Phaser.Math.Clamp(this.luckBonus + 0.04, 0, 0.35);

    this.showToast(msg, 900, '#6b7280');
    this.updateHud();
  }

  private updateHud() {
    const owned = Object.values(this.save.counts).filter((n) => n > 0).length;
    const total = DOLLS.length;
    const luckPct = Math.round(this.luckBonus * 100);

    this.hudText.setText([
      `POKEDEX ${owned}/${total}   |   TRY ${this.attemptsLeft}/${this.attemptsPerRound}   |   LUCK +${luckPct}%   |   STREAK ${this.winStreak}   |   BEST ${this.save.bestStreak}`,
      `P POKEDEX  |  SPACE DROP  |  R RESET`,
    ]);

    // luck bar
    const max = 0.35;
    const fullW = 200;
    const ratio = Phaser.Math.Clamp(this.luckBonus / max, 0, 1);
    this.luckBarFill.width = Math.max(0, Math.round(fullW * ratio));
    // green -> yellow near max
    this.luckBarFill.fillColor = this.luckBonus > 0.25 ? 0xf59e0b : 0x22c55e;
  }

  private createStartOverlay() {
    this.started = false;

    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.55);
    panel.fillRect(0, 0, 960, 540);

    // Pixel-style card (Minecraft-ish)
    const card = this.add.graphics();
    const x = 240;
    const y = 150;
    const w = 480;
    const h = 240;
    card.fillStyle(0x0b1224, 0.96);
    card.fillRect(x, y, w, h);
    // outer border
    card.lineStyle(4, 0x0f172a, 1);
    card.strokeRect(x, y, w, h);
    // inner border highlight
    card.lineStyle(2, 0x475569, 1);
    card.strokeRect(x + 4, y + 4, w - 8, h - 8);

    const title = this.add.text(480, 190, 'claw-doll', {
      fontFamily: '"Press Start 2P",sans-serif',
      fontSize: '28px',
      color: '#e5e7eb',
    }).setOrigin(0.5);

    const subtitle = this.add.text(480, 232, 'pixel claw · collect dolls', {
      fontFamily: '"Press Start 2P","Noto Sans SC",sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const how = this.add.text(480, 280, '←/→ move    Space drop\nP pokedex    R reset', {
      fontFamily: '"Press Start 2P","Noto Sans SC",sans-serif',
      fontSize: '14px',
      color: '#cbd5e1',
      align: 'center',
    }).setOrigin(0.5);

    const start = this.add.text(480, 350, 'Press Space to Start', {
      fontFamily: '"Press Start 2P",sans-serif',
      fontSize: '16px',
      color: '#facc15',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: start,
      alpha: { from: 0.35, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.startOverlay = this.add.container(0, 0, [panel, card, title, subtitle, how, start]).setDepth(100);
  }

  private startRound() {
    this.attemptsLeft = this.attemptsPerRound;
    this.roundNew = new Set();
    this.winStreak = 0;
    this.failStreak = 0;
    this.luckBonus = 0;

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
    panel.fillStyle(0x0b1020, 0.88);
    panel.fillRect(0, 0, 960, 540);

    const card = this.add.graphics();
    card.fillStyle(0x111827, 1);
    card.fillRoundedRect(240, 160, 480, 220, 12);
    card.lineStyle(2, 0x334155, 1);
    card.strokeRoundedRect(240, 160, 480, 220, 12);

    const newCount = this.roundNew.size;
    const title = this.add.text(480, 205, 'ROUND OVER', {
      fontFamily: '"Press Start 2P",sans-serif',
      fontSize: '22px',
      color: '#e5e7eb',
    }).setOrigin(0.5);
    const summary = this.add
      .text(480, 250, `NEW: ${newCount}   |   BEST STREAK: ${this.save.bestStreak}`, {
        fontFamily: '"Press Start 2P","Noto Sans SC",sans-serif',
        fontSize: '12px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(480, 320, 'Press Space to Retry', {
        fontFamily: '"Press Start 2P",sans-serif',
        fontSize: '14px',
        color: '#facc15',
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

    this.roundOverlay = this.add.container(0, 0, [panel, card, title, summary, hint]).setDepth(120);

    // One-shot key handler
    const onKey = () => {
      if (!this.roundOverlay) return;
      this.roundOverlay.destroy(true);
      this.roundOverlay = undefined;
      this.startRound();
    };
    this.input.keyboard!.once('keydown-SPACE', onKey);
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
    this.aimed.setScale(2.18);

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
      this.aimed.setScale(2);
    }
    this.aimed = undefined;
  }

  private showToast(text: string, ms: number, color: string = '#e5e7eb') {
    this.toastText.setText(text);
    this.toastText.setStyle({ color });
    this.toastText.setAlpha(1);
    this.toastText.setScale(1);

    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      scale: { from: 1.4, to: 1.0 },
      duration: 200,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      delay: ms,
      duration: 350,
      ease: 'Sine.easeIn',
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

  private ensureAudio() {
    if (this.audio) return this.audio;
    this.audio = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.audio;
  }

  private beep(freq: number, ms: number, type: OscillatorType = 'square', gain = 0.05) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureAudio();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.02);
  }

  private playMoveSfx() {
    const now = this.time.now;
    if (now - this.lastMoveSfxAt < 90) return;
    this.lastMoveSfxAt = now;
    this.beep(220, 35, 'square', 0.02);
  }

  private playDropSfx() {
    this.beep(180, 70, 'square', 0.03);
  }

  private playFailSfx() {
    this.beep(140, 90, 'sawtooth', 0.03);
  }

  private playWinSfx(def: DollDef) {
    if (def.rarity === 'SSR') {
      this.beep(880, 120, 'square', 0.06);
      this.time.delayedCall(90, () => this.beep(1320, 140, 'square', 0.05));
      return;
    }
    if (def.rarity === 'SR') {
      this.beep(660, 90, 'square', 0.05);
      this.time.delayedCall(70, () => this.beep(990, 110, 'square', 0.04));
      return;
    }
    if (def.rarity === 'R') {
      this.beep(520, 80, 'square', 0.04);
      return;
    }
    this.beep(420, 70, 'square', 0.035);
  }

  private createHotbar() {
    const cx = 480;
    const y = 510;
    const slots = 9;
    const size = 36;
    const pad = 6;
    const totalW = slots * size + (slots - 1) * pad + 20;
    const x0 = cx - totalW / 2;

    // Kenney panel background (scaled)
    const bg = this.add.image(cx, y, 'panel:space').setDepth(30);
    bg.setDisplaySize(totalW, 56);

    const icons: Phaser.GameObjects.Image[] = [];

    for (let i = 0; i < slots; i++) {
      const sx = x0 + 10 + i * (size + pad);
      const sy = y - size / 2;
      // slot
      const slot = this.add.rectangle(sx + size / 2, sy, size, size, 0x111827, 1).setDepth(31);
      slot.setStrokeStyle(2, 0x64748b, 1);

      const icon = this.add.image(sx + size / 2, sy, 'spark').setDepth(32).setVisible(false);
      icons.push(icon);

      // selected (first slot)
      if (i === 0) {
        this.add.rectangle(sx + size / 2, sy, size + 6, size + 6).setDepth(33).setStrokeStyle(3, 0xfacc15, 1);
      }
    }

    const hint = this.add
      .text(cx, y - 42, 'HOTBAR (recent)', {
        fontFamily: '"Press Start 2P",sans-serif',
        fontSize: '10px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setDepth(34);

    this.add.container(0, 0, [bg, hint]).setDepth(30);
    this.hotbarIcons = icons;
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
      icon.setTexture('dolls', def.frame);
      icon.setScale(2);
      icon.setVisible(true);
    }
  }

  private animatePickupToHotbar(def: DollDef) {
    // Fly a small icon from claw to first hotbar slot
    if (!this.hotbarIcons?.[0]) return;
    const target = this.hotbarIcons[0];

    const icon = this.add.image(this.clawX, this.clawY + 44, 'dolls', def.frame).setScale(2).setDepth(200);
    icon.clearTint();

    this.tweens.add({
      targets: icon,
      x: target.x,
      y: target.y,
      scale: 1.4,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        icon.destroy();
        // pulse target
        target.setScale(1.85);
        this.tweens.add({
          targets: target,
          scale: 1.6,
          duration: 180,
          ease: 'Back.easeOut',
        });
      },
    });
  }
}

