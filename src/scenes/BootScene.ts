import Phaser from 'phaser';
import { DOLLS } from '../data';

/** Draw a rounded rectangle path (compatible helper). */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    // Load Twemoji SVG assets for each doll
    for (const doll of DOLLS) {
      this.load.svg(doll.assetKey, `assets/twemoji/${doll.assetKey.replace('twemoji-', '')}.svg`, { width: 64, height: 64 });
    }
  }

  create() {
    this.createTextures();
    this.scene.start('game');
  }

  private createTextures() {

    // Claw body (metallic with dark outline for warm-bg contrast)
    {
      const canvas = this.textures.createCanvas('claw-body', 30, 20)!;
      const ctx = canvas.getContext();
      // Dark outline
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      rrect(ctx, 1, 1, 28, 18, 6);
      ctx.fillStyle = '#3a3a40';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      // Metallic gradient fill
      rrect(ctx, 2, 2, 26, 16, 5);
      const g = ctx.createLinearGradient(0, 2, 0, 18);
      g.addColorStop(0, '#e8edf0');
      g.addColorStop(0.35, '#b8c4cc');
      g.addColorStop(0.65, '#8a9aa6');
      g.addColorStop(1, '#6b7b88');
      ctx.fillStyle = g;
      ctx.fill();
      // Top highlight edge
      rrect(ctx, 4, 3, 22, 6, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
      // Dark border
      rrect(ctx, 1, 1, 28, 18, 6);
      ctx.strokeStyle = '#2a2a30';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      canvas.refresh();
    }

    // Claw arms helper: draw one arm piece with metallic look
    const drawArmPiece = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      rrect(ctx, x, y, w, h, r);
      ctx.fillStyle = '#3a3a40';
      ctx.fill();
      rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
      const ag = ctx.createLinearGradient(x, y, x, y + h);
      ag.addColorStop(0, '#d0d8dd');
      ag.addColorStop(0.5, '#98a8b4');
      ag.addColorStop(1, '#707e88');
      ctx.fillStyle = ag;
      ctx.fill();
      rrect(ctx, x, y, w, h, r);
      ctx.strokeStyle = '#2a2a30';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    // Claw arms (open)
    {
      const canvas = this.textures.createCanvas('claw-arms-open', 28, 20)!;
      const ctx = canvas.getContext();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      drawArmPiece(ctx, 0, 0, 7, 18, 3);
      drawArmPiece(ctx, 0, 15, 12, 4, 2);
      drawArmPiece(ctx, 21, 0, 7, 18, 3);
      drawArmPiece(ctx, 16, 15, 12, 4, 2);
      canvas.refresh();
    }

    // Claw arms (closed)
    {
      const canvas = this.textures.createCanvas('claw-arms-closed', 28, 20)!;
      const ctx = canvas.getContext();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      drawArmPiece(ctx, 2, 0, 7, 18, 3);
      drawArmPiece(ctx, 5, 15, 12, 4, 2);
      drawArmPiece(ctx, 19, 0, 7, 18, 3);
      drawArmPiece(ctx, 11, 15, 12, 4, 2);
      canvas.refresh();
    }

    // Spark (soft radial glow)
    {
      const canvas = this.textures.createCanvas('spark', 12, 12)!;
      const ctx = canvas.getContext();
      const g = ctx.createRadialGradient(6, 6, 0, 6, 6, 6);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,245,157,0.6)');
      g.addColorStop(1, 'rgba(255,245,157,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 12, 12);
      canvas.refresh();
    }

    // Soft confetti circle
    {
      const canvas = this.textures.createCanvas('pixel-chunk', 6, 6)!;
      const ctx = canvas.getContext();
      ctx.beginPath();
      ctx.arc(3, 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      canvas.refresh();
    }

    // Vignette overlay (warm corners, reduced strength)
    {
      const w = 960, h = 540;
      const canvas = this.textures.createCanvas('vignette', w, h)!;
      const ctx = canvas.getContext();
      const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.30, w / 2, h / 2, w * 0.74);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(42,26,46,0.38)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      canvas.refresh();
    }

    // Subtle grain overlay
    {
      const w = 960, h = 540;
      const canvas = this.textures.createCanvas('grain', w, h)!;
      const ctx = canvas.getContext();
      const imgData = ctx.createImageData(w, h);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = Math.random() * 255;
        imgData.data[i] = v;
        imgData.data[i + 1] = v;
        imgData.data[i + 2] = v;
        imgData.data[i + 3] = 10;
      }
      ctx.putImageData(imgData, 0, 0);
      canvas.refresh();
    }
  }
}
