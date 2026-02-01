import { get, set, del, keys } from 'idb-keyval';
import type { ItemMetaBox, FileType, Provider } from './types';

const HISTORE = 'history-v1';
const OPENAI_KEY = 'openai_key';
const GEMINI_KEY = 'gemini_key';
const SETTINGS_KEY = 'gen_settings';

export interface SavedSettings {
  provider: Provider;
  model: string;
  fileType: FileType;
  titleLength: number;
  descriptionLength: number;
  keywordsCount: number;
  extraInstructions: string;
}

export async function saveHistoryItem(it: ItemMetaBox) {
  const id = `${HISTORE}:${it.id}`;
  await set(id, it);
}

export async function deleteHistoryItem(id: string) {
  const key = `${HISTORE}:${id}`;
  await del(key);
}

export async function deleteHistoryItems(ids: string[]) {
  await Promise.all(ids.map((id) => deleteHistoryItem(id)));
}

export async function loadHistory(page: number, pageSize: number) {
  const allKeys = (await keys()) as string[];
  const histKeys = allKeys.filter((k) => k.startsWith(`${HISTORE}:`)).sort().reverse();
  const start = page * pageSize;
  const pageKeys = histKeys.slice(start, start + pageSize);
  const items = await Promise.all(pageKeys.map((k) => get<ItemMetaBox>(k)));
  return { items: items.filter(Boolean) as ItemMetaBox[], total: histKeys.length };
}

export async function getHistoryItem(id: string): Promise<ItemMetaBox | undefined> {
  const key = `${HISTORE}:${id}`;
  return get<ItemMetaBox>(key);
}

export function saveApiKey(provider: Provider, key: string) {
  localStorage.setItem(provider === 'openai' ? OPENAI_KEY : GEMINI_KEY, key.trim());
}

export function getApiKey(provider: Provider) {
  return localStorage.getItem(provider === 'openai' ? OPENAI_KEY : GEMINI_KEY) || '';
}

export function saveSettings(settings: SavedSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings(): SavedSettings | null {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as SavedSettings;
  } catch {
    return null;
  }
}
