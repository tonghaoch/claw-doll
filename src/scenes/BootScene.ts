import Phaser from 'phaser';
import { DOLLS } from '../data';
import type { DollSymbol } from '../data';

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

/** Draw a small geometric symbol at (x, y) with given radius. */
function drawSymbol(ctx: CanvasRenderingContext2D, type: DollSymbol, x: number, y: number, s: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  switch (type) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y + s * 0.7);
      ctx.lineTo(x - s, y + s * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        const b = a + Math.PI / 5;
        ctx.lineTo(x + Math.cos(b) * s * 0.45, y + Math.sin(b) * s * 0.45);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.7, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.7, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'heart': {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.7);
      ctx.bezierCurveTo(x - s * 1.3, y - s * 0.2, x - s * 0.4, y - s * 1.1, x, y - s * 0.3);
      ctx.bezierCurveTo(x + s * 0.4, y - s * 1.1, x + s * 1.3, y - s * 0.2, x, y + s * 0.7);
      ctx.fill();
      break;
    }
    case 'hexagon':
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'crescent':
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x + s * 0.45, y - s * 0.25, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
  }
  ctx.restore();
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
    const cx = SIZE / 2;

    // Modern sticker for each doll: round bg + face + symbol badge
    for (const doll of DOLLS) {
      const canvas = this.textures.createCanvas(doll.id, SIZE, SIZE)!;
      const ctx = canvas.getContext();

      const red = (doll.color >> 16) & 0xff;
      const grn = (doll.color >> 8) & 0xff;
      const blu = doll.color & 0xff;
      const r = SIZE / 2 - 2;

      // Circular background with radial gradient
      ctx.beginPath();
      ctx.arc(cx, cx, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(cx - 6, cx - 8, 2, cx, cx, r);
      grad.addColorStop(0, `rgb(${Math.min(255, red + 50)},${Math.min(255, grn + 50)},${Math.min(255, blu + 50)})`);
      grad.addColorStop(1, `rgb(${Math.max(0, red - 25)},${Math.max(0, grn - 25)},${Math.max(0, blu - 25)})`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Glass highlight ellipse
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cx, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(cx, cx - 10, 18, 10, -0.15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      ctx.restore();

      // Border
      ctx.beginPath();
      ctx.arc(cx, cx, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Eyes
      const eyeY = cx + 3;
      const eyeGap = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - eyeGap, eyeY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeGap, eyeY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Pupils
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(cx - eyeGap + 1, eyeY + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeGap + 1, eyeY + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Eye shine
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(cx - eyeGap - 0.5, eyeY - 1.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeGap - 0.5, eyeY - 1.5, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      ctx.beginPath();
      ctx.arc(cx, eyeY + 10, 5, 0.15, Math.PI - 0.15);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Blush cheeks
      ctx.fillStyle = 'rgba(255,130,130,0.22)';
      ctx.beginPath();
      ctx.ellipse(cx - 15, eyeY + 5, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 15, eyeY + 5, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Symbol badge on forehead
      drawSymbol(ctx, doll.symbol, cx, cx - 12, 6);

      canvas.refresh();
    }

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
