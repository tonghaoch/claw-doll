import { DOLLS } from './data';

export type SaveV1 = {
  version: 1;
  counts: Record<string, number>; // dollId -> count
  bestStreak: number;
  recent: string[]; // most recently obtained doll ids
};

const KEY = 'claw-doll-save-v1';

export function loadSave(): SaveV1 {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || typeof parsed?.counts !== 'object') return newSave();
    return {
      version: 1,
      counts: parsed.counts ?? {},
      bestStreak: Number(parsed.bestStreak ?? 0) || 0,
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter((x: any) => typeof x === 'string') : [],
    };
  } catch {
    return newSave();
  }
}

export function saveNow(save: SaveV1) {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function newSave(): SaveV1 {
  const counts: Record<string, number> = {};
  for (const d of DOLLS) counts[d.id] = 0;
  return { version: 1, counts, bestStreak: 0, recent: [] };
}

export function clearSave() {
  localStorage.removeItem(KEY);
}
