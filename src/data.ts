export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

export type DollDef = {
  id: string;
  name: string;
  rarity: Rarity;
  catchRate: number; // 0..1 base
  color: number; // 0xRRGGBB
  assetKey: string; // Phaser texture key for the Twemoji SVG
};

export const DOLLS: DollDef[] = [
  { id: 'doll-panda', name: '熊猫', rarity: 'N', catchRate: 0.65, color: 0xe5e7eb, assetKey: 'twemoji-panda' },
  { id: 'doll-cat', name: '小猫', rarity: 'N', catchRate: 0.60, color: 0xf0c674, assetKey: 'twemoji-cat' },

  { id: 'doll-rabbit', name: '兔子', rarity: 'R', catchRate: 0.45, color: 0xf1c40f, assetKey: 'twemoji-rabbit' },
  { id: 'doll-penguin', name: '企鹅', rarity: 'R', catchRate: 0.40, color: 0x3498db, assetKey: 'twemoji-penguin' },

  { id: 'doll-owl', name: '猫头鹰', rarity: 'SR', catchRate: 0.25, color: 0x9b59b6, assetKey: 'twemoji-owl' },
  { id: 'doll-frog', name: '青蛙', rarity: 'SR', catchRate: 0.22, color: 0x2ecc71, assetKey: 'twemoji-frog' },

  { id: 'doll-unicorn', name: '独角兽', rarity: 'SSR', catchRate: 0.12, color: 0xfacc15, assetKey: 'twemoji-unicorn' },
];

export const rarityColor: Record<Rarity, string> = {
  N: '#f5e6d3',
  R: '#4fc3f7',
  SR: '#ff8a65',
  SSR: '#ffd54f',
};

export function rarityLabel(r: Rarity) {
  return r;
}
