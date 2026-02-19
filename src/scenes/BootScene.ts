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
    // No external assets — all textures generated at runtime.
  }

  create() {
    this.createTextures();
    this.scene.start('game');
  }

  private createTextures() {
    const SIZE = 64;

    // Modern flat sticker for each doll
    for (const doll of DOLLS) {
      const canvas = this.textures.createCanvas(doll.id, SIZE, SIZE)!;
      const ctx = canvas.getContext();

      const red = (doll.color >> 16) & 0xff;
      const grn = (doll.color >> 8) & 0xff;
      const blu = doll.color & 0xff;

      // Rounded rect background with gradient
      rrect(ctx, 2, 2, SIZE - 4, SIZE - 4, 16);
      const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
      grad.addColorStop(0, `rgb(${Math.min(255, red + 40)},${Math.min(255, grn + 40)},${Math.min(255, blu + 40)})`);
      grad.addColorStop(1, `rgb(${Math.max(0, red - 30)},${Math.max(0, grn - 30)},${Math.max(0, blu - 30)})`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Glass highlight on upper half
      rrect(ctx, 6, 4, SIZE - 12, SIZE / 2 - 8, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();

      // Border
      rrect(ctx, 2, 2, SIZE - 4, SIZE - 4, 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Emoji
      ctx.font = '32px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillText(doll.emoji, SIZE / 2, SIZE / 2 + 2);
      ctx.shadowColor = 'transparent';

      canvas.refresh();
    }

    // Claw body (smooth rounded)
    {
      const canvas = this.textures.createCanvas('claw-body', 28, 18)!;
      const ctx = canvas.getContext();
      rrect(ctx, 1, 1, 26, 16, 6);
      const g = ctx.createLinearGradient(0, 0, 0, 18);
      g.addColorStop(0, '#cfd8dc');
      g.addColorStop(1, '#90a4ae');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      canvas.refresh();
    }

    // Claw arms (open)
    {
      const canvas = this.textures.createCanvas('claw-arms-open', 28, 20)!;
      const ctx = canvas.getContext();
      ctx.fillStyle = '#b0bec5';
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      rrect(ctx, 0, 0, 7, 18, 3); ctx.fill(); ctx.stroke();
      rrect(ctx, 0, 15, 12, 4, 2); ctx.fill(); ctx.stroke();
      rrect(ctx, 21, 0, 7, 18, 3); ctx.fill(); ctx.stroke();
      rrect(ctx, 16, 15, 12, 4, 2); ctx.fill(); ctx.stroke();
      canvas.refresh();
    }

    // Claw arms (closed)
    {
      const canvas = this.textures.createCanvas('claw-arms-closed', 28, 20)!;
      const ctx = canvas.getContext();
      ctx.fillStyle = '#b0bec5';
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      rrect(ctx, 2, 0, 7, 18, 3); ctx.fill(); ctx.stroke();
      rrect(ctx, 5, 15, 12, 4, 2); ctx.fill(); ctx.stroke();
      rrect(ctx, 19, 0, 7, 18, 3); ctx.fill(); ctx.stroke();
      rrect(ctx, 11, 15, 12, 4, 2); ctx.fill(); ctx.stroke();
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

    // Vignette overlay (dark corners)
    {
      const w = 960, h = 540;
      const canvas = this.textures.createCanvas('vignette', w, h)!;
      const ctx = canvas.getContext();
      const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.72);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
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

    // Soft radial blob for background atmosphere
    {
      const sz = 256;
      const canvas = this.textures.createCanvas('bg-blob', sz, sz)!;
      const ctx = canvas.getContext();
      const g = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, sz, sz);
      canvas.refresh();
    }
  }
}
