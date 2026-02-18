export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

export type DollDef = {
  id: string;
  name: string;
  rarity: Rarity;
  catchRate: number; // 0..1 base
  color: number; // 0xRRGGBB
};

export const DOLLS: DollDef[] = [
  { id: 'doll-apple', name: '苹果娃娃', rarity: 'N', catchRate: 0.65, color: 0xe74c3c },
  { id: 'doll-banana', name: '香蕉娃娃', rarity: 'N', catchRate: 0.60, color: 0xf1c40f },
  { id: 'doll-mint', name: '薄荷娃娃', rarity: 'R', catchRate: 0.45, color: 0x2ecc71 },
  { id: 'doll-berry', name: '莓莓娃娃', rarity: 'R', catchRate: 0.40, color: 0x9b59b6 },
  { id: 'doll-cloud', name: '云朵娃娃', rarity: 'SR', catchRate: 0.25, color: 0x3498db },
  { id: 'doll-star', name: '星星娃娃', rarity: 'SR', catchRate: 0.22, color: 0xf39c12 },
  { id: 'doll-king', name: '国王娃娃', rarity: 'SSR', catchRate: 0.12, color: 0xecf0f1 },
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
