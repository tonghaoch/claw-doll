import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    // Kenney assets (CC0)
    this.load.spritesheet('ui', 'assets/kenney/pixel-ui-pack/Spritesheet/UIpackSheet_transparent.png', {
      frameWidth: 16,
      frameHeight: 16,
      margin: 2,
      spacing: 2,
    });

    this.load.atlasXML(
      'animals',
      'assets/kenney/animal-pack-redux/Spritesheet/square.png',
      'assets/kenney/animal-pack-redux/Spritesheet/square.xml',
    );

    // 9-slice panels we can scale freely
    this.load.image('panel:space', 'assets/kenney/pixel-ui-pack/9-Slice/space.png');
    this.load.image('panel:space_inlay', 'assets/kenney/pixel-ui-pack/9-Slice/space_inlay.png');
  }

  create() {
    // Some pixel textures generated at runtime.
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
