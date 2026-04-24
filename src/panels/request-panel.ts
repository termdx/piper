import type { RenderContext, Renderable } from "@opentui/core";
import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  CodeRenderable,
  SyntaxStyle,
  TextAttributes,
} from "@opentui/core";
import type { Theme, HistoryEntry } from "../types";
import { highlightJson } from "../utils/json-highlight";
import { historyStore } from "../utils/history";
import { findEnvVars, getEnvVar } from "../utils/env";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];

function getMethodColor(method: string, theme: Theme): string {
  switch (method.toUpperCase()) {
    case "GET": return theme.colors.success;
    case "POST": return theme.colors.primary;
    case "PUT": return theme.colors.accent;
    case "DELETE": return theme.colors.error;
    case "PATCH": return theme.colors.secondary;
    default: return theme.colors.muted;
  }
}

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

function setCodeStyledText(code: CodeRenderable, content: string, theme: Theme) {
  const styled = highlightJson(content, theme);
  const c = code as any;
  c.textBuffer.setStyledText(styled);
  c._shouldRenderTextBuffer = true;
  c.updateTextInfo();
  code.requestRender();
}

export class RequestPanel {
  panel: BoxRenderable;
  methodDisplay: BoxRenderable;
  methodText: TextRenderable;
  urlInput: InputRenderable;
  urlGhost: TextRenderable;
  bodyPreview: CodeRenderable;
  headersPreview: CodeRenderable;
  sendButton: BoxRenderable;
  sendButtonText: TextRenderable;

  private urlBarBox: BoxRenderable;
  private spinnerInterval?: Timer;
  private spinnerFrame = 0;
  private bodyContent = "";
  private headersContent = "";
  private selectedMethod = "GET";
  private theme: Theme;
  private historyEntries: HistoryEntry[] = [];
  private historyLoaded = false;
  private currentSuggestion?: HistoryEntry;
  private currentEnvVar?: string;
  private ghostText = "";
  private lastGhostQuery = "";

  onSend?: () => void;
  onMethodClick?: () => void;
  onSuggestionSelect?: (entry: HistoryEntry) => void;

  constructor(renderer: RenderContext, theme: Theme) {
    this.theme = theme;

    this.panel = new BoxRenderable(renderer, {
      id: "request-panel",
      flexDirection: "column",
      backgroundColor: darkenColor(theme.colors.background, 30),
      padding: 1,
      flexGrow: 1,
      gap: 1,
    });

    const label = new TextRenderable(renderer, {
      content: " Request ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
      alignSelf: "flex-start",
    });
    this.panel.add(label);

    const innerBg = darkenColor(theme.colors.background, 10);

    // ── URL bar ──
    this.urlBarBox = new BoxRenderable(renderer, {
      id: "url-bar-box",
      flexDirection: "row",
      height: 3,
      backgroundColor: innerBg,
      paddingX: 1,
      paddingY: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      overflow: "hidden",
    });

    this.methodDisplay = new BoxRenderable(renderer, {
      id: "method-display",
      width: 6,
      height: 3,
      backgroundColor: innerBg,
      alignItems: "center",
      justifyContent: "center",
      onMouseDown: () => this.onMethodClick?.(),
    });
    this.methodText = new TextRenderable(renderer, {
      content: "GET",
      fg: theme.colors.accent,
      attributes: TextAttributes.BOLD,
    });
    this.methodDisplay.add(this.methodText);

    this.urlInput = new InputRenderable(renderer, {
      id: "url-input",
      placeholder: "https://api.example.com",
      flexGrow: 1,
      backgroundColor: innerBg,
      textColor: theme.colors.white,
      cursorColor: theme.colors.accent,
      focusedBackgroundColor: innerBg,
      wrapMode: "none",
    });

    this.urlBarBox.add(this.methodDisplay);
    this.urlBarBox.add(this.urlInput);

    this.urlGhost = new TextRenderable(renderer, {
      id: "url-ghost",
      content: "",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
      zIndex: 1,
    });
    (this.urlGhost as any).position = "absolute";
    this.urlBarBox.add(this.urlGhost);

    this.panel.add(this.urlBarBox);

    this.urlInput.on("input", () => {
      const value = this.urlInput.value ?? "";
      if (value.length >= 2) {
        this.updateGhost(value);
      } else {
        this.clearGhost();
      }
    });

    // ── Body preview ──
    const bodyLabel = new TextRenderable(renderer, {
      content: " Body ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
    });
    this.panel.add(bodyLabel);

    this.bodyPreview = new CodeRenderable(renderer, {
      id: "body-preview",
      content: "",
      syntaxStyle: SyntaxStyle.create(),
      flexGrow: 1,
    });
    this.panel.add(this.bodyPreview);

    // ── Headers preview ──
    const headersLabel = new TextRenderable(renderer, {
      content: " Headers ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
    });
    this.panel.add(headersLabel);

    this.headersPreview = new CodeRenderable(renderer, {
      id: "headers-preview",
      content: "",
      syntaxStyle: SyntaxStyle.create(),
      flexGrow: 1,
    });
    this.panel.add(this.headersPreview);

    // ── Send button ──
    this.sendButton = new BoxRenderable(renderer, {
      id: "send-button",
      width: 16,
      height: 3,
      backgroundColor: innerBg,
      paddingX: 1,
      paddingY: 1,
      alignSelf: "center",
      onMouseDown: () => this.onSend?.(),
    });
    this.sendButtonText = new TextRenderable(renderer, {
      content: " send (ctrl+↵) ",
      fg: theme.colors.white,
      attributes: TextAttributes.BOLD,
    });
    this.sendButton.add(this.sendButtonText);
    this.panel.add(this.sendButton);
  }

  private async ensureHistoryLoaded() {
    if (this.historyLoaded) return;
    this.historyEntries = await historyStore.load();
    this.historyLoaded = true;
  }

  private updateGhost(query: string) {
    this.lastGhostQuery = query;

    // Check if we're inside an env var reference ${...}
    const envMatch = this.matchEnvVar(query);
    if (envMatch) {
      const matches = findEnvVars(envMatch.partial);
      if (matches.length > 0) {
        const best = matches[0]!;
        this.currentEnvVar = best;
        this.currentSuggestion = undefined;
        this.ghostText = best.slice(envMatch.partial.length) + "}";
        this.urlGhost.content = this.ghostText;
        this.urlGhost.fg = this.theme.colors.cool;
        this.urlGhost.attributes = 0; // no dim
        this.repositionGhost(envMatch.cursorPos);
        return;
      }
    }

    // Fall back to history URL suggestions
    void this.ensureHistoryLoaded().then(() => {
      // Guard against stale async callbacks overwriting newer ghosts
      if (this.lastGhostQuery !== query) return;
      const best = this.findBestMatch(query);
      if (best) {
        this.currentSuggestion = best;
        this.currentEnvVar = undefined;
        this.ghostText = best.url.slice(query.length);
        this.urlGhost.content = this.ghostText;
        this.urlGhost.fg = this.theme.colors.muted;
        this.urlGhost.attributes = TextAttributes.DIM;
        this.repositionGhost(query.length);
      } else {
        this.clearGhost();
      }
    });
  }

  private matchEnvVar(query: string): { partial: string; cursorPos: number } | undefined {
    // Find the last unclosed ${
    let lastOpen = -1;
    for (let i = 0; i < query.length - 1; i++) {
      if (query[i] === "$" && query[i + 1] === "{") {
        lastOpen = i;
      }
    }
    if (lastOpen === -1) return undefined;

    // Check if there's a closing } after the last ${
    const afterOpen = query.slice(lastOpen + 2);
    if (afterOpen.includes("}")) return undefined;

    // Cursor is at end of query
    const partial = afterOpen;
    const cursorPos = query.length;
    return { partial, cursorPos };
  }

  private findBestMatch(query: string): HistoryEntry | undefined {
    const q = query.toLowerCase();
    const matches = this.historyEntries.filter((e) =>
      e.url.toLowerCase().includes(q)
    );
    if (matches.length === 0) return undefined;
    matches.sort((a, b) => {
      const aIdx = a.url.toLowerCase().indexOf(q);
      const bIdx = b.url.toLowerCase().indexOf(q);
      if (aIdx !== bIdx) return aIdx - bIdx;
      const aExact = a.url.includes(query);
      const bExact = b.url.includes(query);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.url.length - b.url.length;
    });
    return matches[0];
  }

  private repositionGhost(textLength: number) {
    const baseOffset = 6 + 1 + 1;
    (this.urlGhost as any).left = baseOffset + textLength;
    (this.urlGhost as any).top = 1;
    this.urlBarBox.requestRender();
  }

  clearGhost() {
    this.currentSuggestion = undefined;
    this.currentEnvVar = undefined;
    this.ghostText = "";
    this.urlGhost.content = "";
    this.urlGhost.fg = this.theme.colors.muted;
    this.urlGhost.attributes = TextAttributes.DIM;
    (this.urlGhost as any).left = 0;
  }

  get ghostVisible(): boolean {
    return this.ghostText.length > 0;
  }

  acceptGhost() {
    if (this.currentEnvVar) {
      const value = this.urlInput.value ?? "";
      const lastOpen = value.lastIndexOf("${");
      if (lastOpen >= 0) {
        const before = value.slice(0, lastOpen + 2);
        const after = value.slice(lastOpen + 2);
        const closeIdx = after.indexOf("}");
        const suffix = closeIdx >= 0 ? after.slice(closeIdx) : "";
        this.urlInput.value = before + this.currentEnvVar + suffix;
      }
      this.clearGhost();
      return;
    }
    if (this.currentSuggestion) {
      this.urlInput.value = this.currentSuggestion.url;
      this.onSuggestionSelect?.(this.currentSuggestion);
      this.clearGhost();
    }
  }

  setSending(isLoading: boolean) {
    const PROGRESS_FRAMES = [
      "░▒▓█ Sending",
      "█░▒▓ Sending",
      "▓█░▒ Sending",
      "▒▓█░ Sending",
    ];
    if (isLoading) {
      this.spinnerFrame = 0;
      this.sendButtonText.content = PROGRESS_FRAMES[0]!;
      this.sendButtonText.fg = this.theme.colors.accent;
      this.spinnerInterval = setInterval(() => {
        this.spinnerFrame = (this.spinnerFrame + 1) % PROGRESS_FRAMES.length;
        this.sendButtonText.content = PROGRESS_FRAMES[this.spinnerFrame]!;
      }, 150);
    } else {
      if (this.spinnerInterval) {
        clearInterval(this.spinnerInterval);
        this.spinnerInterval = undefined;
      }
      this.sendButtonText.content = " send (ctrl+↵) ";
      this.sendButtonText.fg = this.theme.colors.white;
    }
  }

  applyTheme(theme: Theme) {
    this.theme = theme;
    this.panel.backgroundColor = darkenColor(theme.colors.background, 30);

    const innerBg = darkenColor(theme.colors.background, 10);
    this.urlBarBox.backgroundColor = innerBg;

    this.methodDisplay.backgroundColor = innerBg;
    this.methodText.fg = theme.colors.accent;

    this.urlInput.backgroundColor = innerBg;
    this.urlInput.textColor = theme.colors.white;
    this.urlInput.cursorColor = theme.colors.accent;
    this.urlInput.focusedBackgroundColor = innerBg;
    this.urlGhost.fg = this.currentEnvVar ? theme.colors.cool : theme.colors.muted;
    this.urlGhost.attributes = this.currentEnvVar ? 0 : TextAttributes.DIM;

    setCodeStyledText(this.bodyPreview, this.bodyContent || "{}", theme);
    setCodeStyledText(this.headersPreview, this.headersContent || "{}", theme);

    this.sendButton.backgroundColor = innerBg;
    if (!this.spinnerInterval) {
      this.sendButtonText.fg = theme.colors.white;
    }
  }

  getFocusables(): Renderable[] {
    return [this.urlInput];
  }

  getMethod(): string {
    return this.selectedMethod;
  }

  getUrl(): string {
    return this.urlInput.value ?? "";
  }

  getHeaders(): string {
    return this.headersContent;
  }

  getBody(): string {
    return this.bodyContent;
  }

  setUrl(url: string) {
    this.clearGhost();
    this.urlInput.value = url;
  }

  setHeaders(headers: string) {
    this.headersContent = headers;
    setCodeStyledText(this.headersPreview, headers || "{}", this.theme);
  }

  setBody(body: string) {
    this.bodyContent = body;
    setCodeStyledText(this.bodyPreview, body || "{}", this.theme);
  }

  setMethod(method: string) {
    const idx = HTTP_METHODS.indexOf(method.toUpperCase());
    if (idx >= 0) {
      this.selectedMethod = HTTP_METHODS[idx]!;
      this.methodText.content = this.selectedMethod;
    }
  }
}
