import { get, set, keys } from 'idb-keyval';
import type { ItemMetaBox } from './types';

const HISTORE = 'history-v1';
const OPENAI_KEY = 'openai_key';
const GEMINI_KEY = 'gemini_key';

export async function saveHistoryItem(it: ItemMetaBox) {
  const id = `${HISTORE}:${it.id}`;
  await set(id, it);
}

export async function loadHistory(page: number, pageSize: number) {
  const allKeys = (await keys()) as string[];
  const histKeys = allKeys.filter((k) => k.startsWith(`${HISTORE}:`)).sort().reverse();
  const start = page * pageSize;
  const pageKeys = histKeys.slice(start, start + pageSize);
  const items = await Promise.all(pageKeys.map((k) => get<ItemMetaBox>(k)));
  return { items: items.filter(Boolean) as ItemMetaBox[], total: histKeys.length };
}

export function saveApiKey(provider: 'openai' | 'gemini', key: string) {
  localStorage.setItem(provider === 'openai' ? OPENAI_KEY : GEMINI_KEY, key.trim());
}

export function getApiKey(provider: 'openai' | 'gemini') {
  return localStorage.getItem(provider === 'openai' ? OPENAI_KEY : GEMINI_KEY) || '';
}
