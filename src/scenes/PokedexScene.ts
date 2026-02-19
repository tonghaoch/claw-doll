import Phaser from 'phaser';
import { DOLLS, rarityLabel } from '../data';
import type { SaveV1 } from '../save';

const UI_FONT = 'Inter, "Noto Sans SC", system-ui, sans-serif';

export class PokedexScene extends Phaser.Scene {
  private save!: SaveV1;
  private keyEsc!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('pokedex');
  }

  init(data: { save: SaveV1 }) {
    this.save = data.save;
  }

  create() {
    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    const w = 960;
    const h = 540;

    const panel = this.add.graphics();
    panel.fillStyle(0x0b1020, 0.92);
    panel.fillRect(0, 0, w, h);
    panel.fillStyle(0x3a2a3e, 1);
    panel.fillRoundedRect(80, 60, 800, 420, 10);
    panel.lineStyle(2, 0x334155, 1);
    panel.strokeRoundedRect(80, 60, 800, 420, 10);

    const owned = Object.values(this.save.counts).filter((n) => n > 0).length;

    this.add
      .text(480, 84, `图鉴 ${owned}/${DOLLS.length}`, { fontFamily: UI_FONT, fontSize: '18px', color: '#e5e7eb' })
      .setOrigin(0.5);

    this.add
      .text(480, 110, `Esc 返回`, { fontFamily: UI_FONT, fontSize: '13px', color: '#94a3b8' })
      .setOrigin(0.5);

    // grid
    const cols = 4;
    const cellW = 180;
    const cellH = 78;
    const startX = 140;
    const startY = 150;

    for (let i = 0; i < DOLLS.length; i++) {
      const d = DOLLS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * cellW;
      const y = startY + row * cellH;

      const count = this.save.counts[d.id] ?? 0;
      const owned = count > 0;

      const g = this.add.graphics();
      g.fillStyle(owned ? 0x3b2240 : 0x2a1a2e, 1);
      g.fillRoundedRect(x, y, 160, 62, 8);
      g.lineStyle(2, owned ? 0x64748b : 0x1f2937, 1);
      g.strokeRoundedRect(x, y, 160, 62, 8);

      const icon = this.add.image(x + 28, y + 31, d.id).setScale(0.6);
      if (!owned) icon.setTint(0x374151);

      this.add
        .text(x + 58, y + 16, owned ? d.name : '???', {
          fontFamily: UI_FONT,
          fontSize: '14px',
          color: owned ? '#e5e7eb' : '#6b7280',
        })
        .setOrigin(0, 0);

      this.add
        .text(x + 58, y + 36, owned ? `[${rarityLabel(d.rarity)}] x${count}` : `[${rarityLabel(d.rarity)}] 未获得`, {
          fontSize: '12px',
          fontFamily: UI_FONT,
          color: owned ? '#94a3b8' : '#4b5563',
        })
        .setOrigin(0, 0);
    }
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.scene.stop();
      this.scene.resume('game');
    }
  }
}
