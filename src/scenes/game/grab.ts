import Phaser from 'phaser';
import type { DollDef } from '../../data';

type DollSprite = Phaser.Physics.Arcade.Image & { def: DollDef };

export type GrabContext = {
  clawX: number;
  clawY: number;
  dolls: Phaser.Physics.Arcade.Group;
  debugGrab: boolean;
  grabDebugGfx?: Phaser.GameObjects.Graphics;
  add: Phaser.Scene['add'];
};

export function findGrabCandidate(ctx: GrabContext): DollSprite | undefined {
  // Find nearest doll under claw arms area.
  // Tuned so "visually touching" is more likely to register, especially on mobile.
  // The claw arms sprite is around (clawY + 28). The actual "pinch" feels closer to ~ (clawY + 46).
  const grabW = 66;
  const grabH = 44;
  const grabX = ctx.clawX - grabW / 2;
  const grabY = ctx.clawY + 30;
  const clawRect = new Phaser.Geom.Rectangle(grabX, grabY, grabW, grabH);

  if (ctx.debugGrab) {
    const g = (ctx.grabDebugGfx ??= ctx.add.graphics().setDepth(9999));
    g.lineStyle(2, 0xf59e0b, 0.9);
    g.strokeRectShape(clawRect);
  }

  let best: DollSprite | undefined;
  let bestDist = Number.POSITIVE_INFINITY;

  ctx.dolls.children.iterate((obj) => {
    const spr = obj as DollSprite;
    if (!spr?.active) return true;

    const r = spr.getBounds();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(clawRect, r)) return true;

    const d = Phaser.Math.Distance.Between(ctx.clawX, ctx.clawY, spr.x, spr.y);
    if (d < bestDist) {
      bestDist = d;
      best = spr;
    }
    return true;
  });

  return best;
}
