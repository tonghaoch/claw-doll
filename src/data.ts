export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

export type DollSymbol = 'circle' | 'triangle' | 'star' | 'diamond' | 'heart' | 'hexagon' | 'crescent';

export type DollDef = {
  id: string;
  name: string;
  rarity: Rarity;
  catchRate: number; // 0..1 base
  color: number; // 0xRRGGBB
  symbol: DollSymbol; // geometric badge drawn on sticker
};

export const DOLLS: DollDef[] = [
  { id: 'doll-bear', name: '小熊', rarity: 'N', catchRate: 0.65, color: 0xc0855c, symbol: 'circle' },
  { id: 'doll-panda', name: '熊猫', rarity: 'N', catchRate: 0.60, color: 0xe5e7eb, symbol: 'diamond' },

  { id: 'doll-rabbit', name: '兔子', rarity: 'R', catchRate: 0.45, color: 0xf1c40f, symbol: 'triangle' },
  { id: 'doll-penguin', name: '企鹅', rarity: 'R', catchRate: 0.40, color: 0x3498db, symbol: 'hexagon' },

  { id: 'doll-owl', name: '猫头鹰', rarity: 'SR', catchRate: 0.25, color: 0x9b59b6, symbol: 'star' },
  { id: 'doll-frog', name: '青蛙', rarity: 'SR', catchRate: 0.22, color: 0x2ecc71, symbol: 'heart' },

  { id: 'doll-narwhal', name: '独角鲸', rarity: 'SSR', catchRate: 0.12, color: 0xfacc15, symbol: 'crescent' },
];

export const rarityColor: Record<Rarity, string> = {
  N: '#e5e7eb',
  R: '#3498db',
  SR: '#9b59b6',
  SSR: '#f1c40f',
};

export function rarityLabel(r: Rarity) {
  return r;
}
