import { DOLLS } from './data';

export type Upgrades = {
  /** +2% initial luck per level. */
  startLuckLv: number;
  /** +1 attempt per level. */
  attemptsPlusLv: number;
  /** +0.005 luck gain on each fail per level. */
  pityPlusLv: number;
};

export type SaveV2 = {
  version: 2;
  counts: Record<string, number>; // dollId -> count
  bestStreak: number;
  recent: string[]; // most recently obtained doll ids
  coins: number;
  upgrades: Upgrades;
};

// Previous save key (v1) for migration.
const KEY_V1 = 'claw-doll-save-v1';
const KEY_V2 = 'claw-doll-save-v2';

function clampInt(n: any, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function normalizeCounts(counts: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of DOLLS) out[d.id] = 0;
  if (counts && typeof counts === 'object') {
    for (const k of Object.keys(counts)) {
      if (typeof k !== 'string') continue;
      if (!(k in out)) continue;
      out[k] = clampInt((counts as any)[k], 0, 999999);
    }
  }
  return out;
}

export function loadSave(): SaveV2 {
  try {
    const raw2 = localStorage.getItem(KEY_V2);
    if (raw2) {
      const parsed = JSON.parse(raw2);
      if (parsed?.version === 2 && typeof parsed?.counts === 'object') {
        return {
          version: 2,
          counts: normalizeCounts(parsed.counts),
          bestStreak: clampInt(parsed.bestStreak, 0, 999999),
          recent: Array.isArray(parsed.recent) ? parsed.recent.filter((x: any) => typeof x === 'string') : [],
          coins: clampInt(parsed.coins, 0, 999999999),
          upgrades: {
            startLuckLv: clampInt(parsed?.upgrades?.startLuckLv, 0, 5),
            attemptsPlusLv: clampInt(parsed?.upgrades?.attemptsPlusLv, 0, 2),
            pityPlusLv: clampInt(parsed?.upgrades?.pityPlusLv, 0, 4),
          },
        };
      }
    }

    // Migrate v1 -> v2
    const raw1 = localStorage.getItem(KEY_V1);
    if (raw1) {
      const parsed = JSON.parse(raw1);
      if (parsed?.version === 1 && typeof parsed?.counts === 'object') {
        const migrated: SaveV2 = {
          version: 2,
          counts: normalizeCounts(parsed.counts),
          bestStreak: clampInt(parsed.bestStreak, 0, 999999),
          recent: Array.isArray(parsed.recent) ? parsed.recent.filter((x: any) => typeof x === 'string') : [],
          coins: 0,
          upgrades: { startLuckLv: 0, attemptsPlusLv: 0, pityPlusLv: 0 },
        };
        saveNow(migrated);
        return migrated;
      }
    }

    return newSave();
  } catch {
    return newSave();
  }
}

export function saveNow(save: SaveV2) {
  localStorage.setItem(KEY_V2, JSON.stringify(save));
}

export function newSave(): SaveV2 {
  const counts: Record<string, number> = {};
  for (const d of DOLLS) counts[d.id] = 0;
  return {
    version: 2,
    counts,
    bestStreak: 0,
    recent: [],
    coins: 0,
    upgrades: { startLuckLv: 0, attemptsPlusLv: 0, pityPlusLv: 0 },
  };
}

export function clearSave() {
  localStorage.removeItem(KEY_V2);
  localStorage.removeItem(KEY_V1);
}
