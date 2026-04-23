import type { HistoryEntry } from "../types";

const HISTORY_FILE = `${process.env.HOME}/.piper/history.json`;

function entryKey(entry: HistoryEntry): string {
  return `${entry.method}|${entry.url}|${entry.headers ?? ""}|${entry.body ?? ""}`;
}

export function deduplicateHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const result: HistoryEntry[] = [];
  for (const entry of entries) {
    const key = entryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export class HistoryStore {
  async load(): Promise<HistoryEntry[]> {
    try {
      const file = Bun.file(HISTORY_FILE);
      if (!(await file.exists())) return [];
      const data = await file.json();
      if (Array.isArray(data)) return data as HistoryEntry[];
      return [];
    } catch {
      return [];
    }
  }

  async save(entries: HistoryEntry[]) {
    await Bun.write(HISTORY_FILE, JSON.stringify(entries, null, 2));
  }

  async addEntry(entry: HistoryEntry) {
    const entries = await this.load();
    const key = entryKey(entry);
    // Remove existing duplicate so the new entry bubbles to the top
    const filtered = entries.filter((e) => entryKey(e) !== key);
    filtered.unshift(entry);
    // Keep last 100 entries
    if (filtered.length > 100) filtered.length = 100;
    await this.save(filtered);
  }
}

export const historyStore = new HistoryStore();
