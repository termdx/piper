import type { RenderContext, Renderable } from "@opentui/core";
import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  ScrollBoxRenderable,
  TextAttributes,
} from "@opentui/core";
import type { Theme, HistoryEntry } from "../types";
import { HistoryStore, deduplicateHistory } from "../utils/history";

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
  const b = Math.min(255, (num & 0x0000ff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
  const b = Math.max(0, (num & 0x0000ff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 20 ? `${u.pathname.slice(0, 17)}...` : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return url.length > 30 ? `${url.slice(0, 27)}...` : url;
  }
}

function getStatusColor(status: number, theme: Theme): string {
  if (status >= 200 && status < 300) return theme.colors.success;
  if (status >= 400) return theme.colors.error;
  return theme.colors.accent;
}

export class HistoryPanel {
  panel: BoxRenderable;
  searchInput: InputRenderable;
  scrollBox: ScrollBoxRenderable;
  theme: Theme;
  historyStore?: HistoryStore;

  private entries: HistoryEntry[] = [];
  private filtered: HistoryEntry[] = [];
  private selectedIndex = 0;
  private rowRenderables: BoxRenderable[] = [];
  private urlBarBg: string;

  onSelect?: (entry: HistoryEntry) => void;

  constructor(renderer: RenderContext, theme: Theme) {
    this.theme = theme;
    this.urlBarBg = darkenColor(theme.colors.background, 10);

    this.panel = new BoxRenderable(renderer, {
      id: "history-panel",
      flexDirection: "column",
      backgroundColor: darkenColor(theme.colors.background, 30),
      padding: 1,
      flexGrow: 1,
      gap: 1,
    });

    const label = new TextRenderable(renderer, {
      content: " History ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
      alignSelf: "flex-start",
    });
    this.panel.add(label);

    // Search input
    this.searchInput = new InputRenderable(renderer, {
      id: "history-search",
      placeholder: "Search history...",
      flexGrow: 1,
      backgroundColor: this.urlBarBg,
      textColor: theme.colors.white,
      cursorColor: theme.colors.accent,
      focusedBackgroundColor: theme.colors.muted,
      wrapMode: "none",
    });
    this.searchInput.on("change", () => {
      this.filter(this.searchInput.value);
    });
    this.searchInput.onSubmit = () => {
      if (this.filtered.length > 0) {
        this.onSelect?.(this.filtered[this.selectedIndex] ?? this.filtered[0]!);
      }
    };
    this.panel.add(this.searchInput);

    // Scrollbox for list
    this.scrollBox = new ScrollBoxRenderable(renderer, {
      id: "history-scrollbox",
      flexGrow: 1,
      scrollY: true,
      scrollbarOptions: {
        showArrows: true,
        trackOptions: {
          foregroundColor: theme.colors.primary,
          backgroundColor: theme.colors.muted,
        },
      },
    });
    this.panel.add(this.scrollBox);

    this.loadHistory();
  }

  async loadHistory() {
    if (!this.historyStore) {
      this.entries = [];
      this.filtered = [];
      this.renderRows();
      return;
    }
    const raw = await this.historyStore.load();
    this.entries = deduplicateHistory(raw);
    this.filter("");
  }

  private filter(query: string) {
    const q = query.toLowerCase();
    this.filtered = q
      ? this.entries.filter(
          (e) =>
            e.url.toLowerCase().includes(q) ||
            e.method.toLowerCase().includes(q)
        )
      : [...this.entries];
    this.selectedIndex = 0;
    this.renderRows();
  }

  private renderRows() {
    // Clear existing rows
    for (const row of this.rowRenderables) {
      this.scrollBox.remove(row.id ?? "");
    }
    this.rowRenderables = [];

    const r = this.scrollBox.ctx;
    const t = this.theme;

    for (let i = 0; i < this.filtered.length; i++) {
      const entry = this.filtered[i]!;
      const isSelected = i === this.selectedIndex;

      const row = new BoxRenderable(r, {
        id: `history-row-${i}`,
        flexDirection: "row",
        gap: 1,
        paddingX: 1,
        paddingY: 0,
        backgroundColor: isSelected ? this.urlBarBg : undefined,
        onMouseDown: () => {
          this.selectedIndex = i;
          this.renderRows();
          this.onSelect?.(entry);
        },
      });

      const statusText = new TextRenderable(r, {
        content: String(entry.responseStatus ?? "---").padStart(3, " "),
        fg: entry.responseStatus ? getStatusColor(entry.responseStatus, t) : t.colors.muted,
        width: 4,
      });

      const methodText = new TextRenderable(r, {
        content: entry.method.padEnd(6),
        fg: isSelected ? t.colors.accent : t.colors.primary,
        attributes: isSelected ? TextAttributes.BOLD : 0,
        width: 7,
      });

      const urlText = new TextRenderable(r, {
        content: shortenUrl(entry.url),
        fg: isSelected ? t.colors.white : t.colors.muted,
        flexGrow: 1,
      });

      const metaText = new TextRenderable(r, {
        content: entry.responseTime ? `${Math.round(entry.responseTime)}ms` : "",
        fg: t.colors.muted,
        attributes: TextAttributes.DIM,
        width: 6,
      });

      row.add(statusText);
      row.add(methodText);
      row.add(urlText);
      row.add(metaText);

      this.scrollBox.add(row);
      this.rowRenderables.push(row);
    }

    if (this.filtered.length === 0) {
      const empty = new TextRenderable(r, {
        id: "history-empty",
        content: "No history yet",
        fg: t.colors.muted,
        attributes: TextAttributes.DIM,
      });
      this.scrollBox.add(empty);
      this.rowRenderables.push(empty as unknown as BoxRenderable);
    }
  }

  moveSelection(delta: number) {
    if (this.filtered.length === 0) return;
    this.selectedIndex = Math.max(
      0,
      Math.min(this.filtered.length - 1, this.selectedIndex + delta)
    );
    this.renderRows();
    // Scroll selected into view
    const rowId = `history-row-${this.selectedIndex}`;
    this.scrollBox.scrollChildIntoView(rowId);
  }

  selectCurrent() {
    if (this.filtered.length === 0) return;
    const entry = this.filtered[this.selectedIndex];
    if (entry) this.onSelect?.(entry);
  }

  async addEntry(entry: HistoryEntry) {
    if (!this.historyStore) return;
    await this.historyStore.addEntry(entry);
    await this.loadHistory();
  }

  applyTheme(theme: Theme) {
    this.theme = theme;
    this.urlBarBg = darkenColor(theme.colors.background, 10);
    this.panel.backgroundColor = darkenColor(theme.colors.background, 30);
    this.searchInput.backgroundColor = this.urlBarBg;
    this.searchInput.textColor = theme.colors.white;
    this.searchInput.cursorColor = theme.colors.accent;
    this.searchInput.focusedBackgroundColor = theme.colors.muted;
    this.scrollBox.scrollbarOptions = {
      showArrows: true,
      trackOptions: {
        foregroundColor: theme.colors.primary,
        backgroundColor: theme.colors.muted,
      },
    };
    this.renderRows();
  }

  getFocusables(): Renderable[] {
    return [this.searchInput];
  }
}
