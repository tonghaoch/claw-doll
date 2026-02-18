import { DOLLS } from './data';

export type SaveV1 = {
  version: 1;
  counts: Record<string, number>; // dollId -> count
  bestStreak: number;
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
  return { version: 1, counts, bestStreak: 0 };
}

export function clearSave() {
  localStorage.removeItem(KEY);
}
