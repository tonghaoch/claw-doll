import Phaser from 'phaser';
import { DOLLS } from '../data';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    // Simple pixel textures generated at runtime.
    this.createTextures();
    this.scene.start('game');
  }

  private createTextures() {
    // Claw body
    {
      const g = this.add.graphics();
      g.fillStyle(0xb0bec5, 1);
      g.fillRect(0, 0, 22, 14);
      g.fillStyle(0x78909c, 1);
      g.fillRect(2, 2, 18, 10);
      g.generateTexture('claw-body', 22, 14);
      g.destroy();
    }
    // Claw arms (open)
    {
      const g = this.add.graphics();
      g.fillStyle(0xb0bec5, 1);
      // left arm
      g.fillRect(0, 0, 6, 16);
      g.fillRect(0, 14, 10, 2);
      // right arm
      g.fillRect(18, 0, 6, 16);
      g.fillRect(14, 14, 10, 2);
      g.generateTexture('claw-arms-open', 24, 16);
      g.destroy();
    }
    // Claw arms (closed)
    {
      const g = this.add.graphics();
      g.fillStyle(0xb0bec5, 1);
      g.fillRect(0, 0, 6, 16);
      g.fillRect(4, 14, 10, 2);
      g.fillRect(18, 0, 6, 16);
      g.fillRect(10, 14, 10, 2);
      g.generateTexture('claw-arms-closed', 24, 16);
      g.destroy();
    }

    // Dolls textures
    for (const d of DOLLS) {
      const g = this.add.graphics();
      // outline
      g.fillStyle(0x111827, 1);
      g.fillRect(0, 0, 18, 18);
      // body
      g.fillStyle(d.color, 1);
      g.fillRect(1, 1, 16, 16);
      // face pixels
      g.fillStyle(0x0b1020, 1);
      g.fillRect(5, 6, 2, 2);
      g.fillRect(11, 6, 2, 2);
      g.fillRect(8, 11, 2, 1);
      g.generateTexture(`doll:${d.id}`, 18, 18);
      g.destroy();
    }

    // Spark
    {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(3, 0, 2, 8);
      g.fillRect(0, 3, 8, 2);
      g.fillStyle(0xfff59d, 1);
      g.fillRect(3, 3, 2, 2);
      g.generateTexture('spark', 8, 8);
      g.destroy();
    }
  }
}
