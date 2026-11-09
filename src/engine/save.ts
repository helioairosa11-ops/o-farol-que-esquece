import type { SaveSlotData } from './types';

const SAVE_PREFIX = 'farol_save_v1_';

export function saveToSlot(slotId: string, data: SaveSlotData): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SAVE_PREFIX + slotId, JSON.stringify(data));
  } catch (err) {
    console.warn('Unable to save slot', slotId, err);
  }
}

export function loadFromSlot(slotId: string): SaveSlotData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slotId);
    if (!raw) return null;
    return JSON.parse(raw) as SaveSlotData;
  } catch {
    return null;
  }
}

export function deleteSlot(slotId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SAVE_PREFIX + slotId);
}

export function listAllSaves(totalManualSlots = 10): {
  autosave: SaveSlotData | null;
  quicksave: SaveSlotData | null;
  slots: (SaveSlotData | null)[];
} {
  const autosave = loadFromSlot('autosave');
  const quicksave = loadFromSlot('quicksave');
  const slots: (SaveSlotData | null)[] = [];
  for (let i = 1; i <= totalManualSlots; i++) {
    slots.push(loadFromSlot(`slot_${i}`));
  }
  return { autosave, quicksave, slots };
}

export function getMostRecentSave(totalManualSlots = 10): SaveSlotData | null {
  const { autosave, quicksave, slots } = listAllSaves(totalManualSlots);
  const all = [autosave, quicksave, ...slots].filter((s): s is SaveSlotData => s !== null);
  if (all.length === 0) return null;
  all.sort((a, b) => b.timestamp - a.timestamp);
  return all[0];
}

export function exportAllSavesAsJson(totalManualSlots = 10): string {
  const bundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    saves: listAllSaves(totalManualSlots),
  };
  return JSON.stringify(bundle, null, 2);
}

export function importSavesFromJson(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !parsed.saves) return false;
    const { autosave, quicksave, slots } = parsed.saves;
    if (autosave) saveToSlot('autosave', autosave);
    if (quicksave) saveToSlot('quicksave', quicksave);
    if (Array.isArray(slots)) {
      slots.forEach((slot: SaveSlotData | null, idx: number) => {
        if (slot) saveToSlot(`slot_${idx + 1}`, slot);
      });
    }
    return true;
  } catch {
    return false;
  }
}
