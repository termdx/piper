import type { RenderContext, Renderable } from "@opentui/core";
import {
  BoxRenderable,
  TextRenderable,
  CodeRenderable,
  TabSelectRenderable,
  SyntaxStyle,
  TextAttributes,
} from "@opentui/core";
import type { Theme, ApiResponse } from "../types";
import { highlightJson } from "../utils/json-highlight";

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

export class ResponsePanel {
  panel: BoxRenderable;
  statusBadge: TextRenderable;
  tabs: TabSelectRenderable;
  contentContainer: BoxRenderable;
  bodyBox: BoxRenderable;
  headersBox: BoxRenderable;
  bodyCode: CodeRenderable;
  headersCode: CodeRenderable;

  private theme: Theme;
  private activeTab = "body";
  private lastResponse?: ApiResponse;
  private lastError?: string;

  constructor(renderer: RenderContext, theme: Theme) {
    this.theme = theme;

    this.panel = new BoxRenderable(renderer, {
      id: "response-panel",
      flexDirection: "column",
      backgroundColor: darkenColor(theme.colors.background, 30),
      padding: 1,
      flexGrow: 1,
      gap: 1,
    });

    const label = new TextRenderable(renderer, {
      content: " Response ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
      alignSelf: "flex-start",
    });
    this.panel.add(label);

    // Status badge
    this.statusBadge = new TextRenderable(renderer, {
      id: "status-badge",
      content: "Waiting for request...",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
    });
    this.panel.add(this.statusBadge);

    const innerBg = darkenColor(theme.colors.background, 10);

    // Tabs
    this.tabs = new TabSelectRenderable(renderer, {
      id: "response-tabs",
      options: [
        { name: "Body", description: "", value: "body" },
        { name: "Headers", description: "", value: "headers" },
      ],
      tabWidth: 12,
      showDescription: false,
      showUnderline: true,
      selectedBackgroundColor: innerBg,
      selectedTextColor: theme.colors.white,
      textColor: theme.colors.muted,
    });
    this.tabs.setSelectedIndex(0);
    this.tabs.on("itemSelected", (_idx, option) => {
      this.activeTab = option?.value ?? "body";
      this.updateVisibility();
    });
    this.panel.add(this.tabs);

    // Content container
    this.contentContainer = new BoxRenderable(renderer, {
      id: "response-content",
      flexDirection: "column",
      flexGrow: 1,
      overflow: "hidden",
    });

    // Body content
    this.bodyBox = new BoxRenderable(renderer, {
      id: "body-box",
      flexDirection: "column",
      flexGrow: 1,
      overflow: "hidden",
    });
    this.bodyCode = new CodeRenderable(renderer, {
      id: "body-code",
      content: "",
      syntaxStyle: SyntaxStyle.create(),
      flexGrow: 1,
    });
    this.bodyBox.add(this.bodyCode);

    // Headers content
    this.headersBox = new BoxRenderable(renderer, {
      id: "headers-box",
      flexDirection: "column",
      flexGrow: 1,
      overflow: "hidden",
    });
    this.headersCode = new CodeRenderable(renderer, {
      id: "headers-code",
      content: "",
      syntaxStyle: SyntaxStyle.create(),
      flexGrow: 1,
    });
    this.headersBox.add(this.headersCode);

    this.contentContainer.add(this.bodyBox);
    this.panel.add(this.contentContainer);
  }

  private updateVisibility() {
    this.contentContainer.remove("body-box");
    this.contentContainer.remove("headers-box");
    if (this.activeTab === "body") {
      this.contentContainer.add(this.bodyBox);
    } else {
      this.contentContainer.add(this.headersBox);
    }
  }

  setResponse(res: ApiResponse) {
    this.lastResponse = res;
    this.lastError = undefined;
    const status = res.status;
    const badgeText = `${status} ${res.statusText}`;
    this.statusBadge.content = badgeText;

    if (status >= 200 && status < 300) {
      this.statusBadge.fg = this.theme.colors.success;
      this.statusBadge.attributes = TextAttributes.BOLD;
    } else if (status >= 400) {
      this.statusBadge.fg = this.theme.colors.error;
      this.statusBadge.attributes = TextAttributes.BOLD;
    } else {
      this.statusBadge.fg = this.theme.colors.primary;
      this.statusBadge.attributes = TextAttributes.BOLD;
    }

    setCodeStyledText(this.bodyCode, res.body || "{}", this.theme);
    setCodeStyledText(this.headersCode, JSON.stringify(res.headers, null, 2) || "{}", this.theme);
  }

  setError(message: string) {
    this.lastError = message;
    this.lastResponse = undefined;
    this.statusBadge.content = `Error: ${message}`;
    this.statusBadge.fg = this.theme.colors.error;
    this.statusBadge.attributes = TextAttributes.BOLD;
    setCodeStyledText(this.bodyCode, "{}", this.theme);
    setCodeStyledText(this.headersCode, "{}", this.theme);
  }

  applyTheme(theme: Theme) {
    this.theme = theme;
    const innerBg = darkenColor(theme.colors.background, 10);
    this.panel.backgroundColor = darkenColor(theme.colors.background, 30);

    this.tabs.selectedBackgroundColor = innerBg;
    this.tabs.selectedTextColor = theme.colors.white;
    this.tabs.textColor = theme.colors.muted;

    if (this.lastResponse) {
      setCodeStyledText(this.bodyCode, this.lastResponse.body || "{}", theme);
      setCodeStyledText(this.headersCode, JSON.stringify(this.lastResponse.headers, null, 2) || "{}", theme);
    } else if (this.lastError) {
      this.statusBadge.fg = theme.colors.error;
      this.statusBadge.attributes = TextAttributes.BOLD;
      setCodeStyledText(this.bodyCode, "{}", theme);
      setCodeStyledText(this.headersCode, "{}", theme);
    } else {
      this.statusBadge.fg = theme.colors.muted;
      this.statusBadge.attributes = TextAttributes.DIM;
      setCodeStyledText(this.bodyCode, "{}", theme);
      setCodeStyledText(this.headersCode, "{}", theme);
    }
  }

  getFocusables(): Renderable[] {
    return [this.tabs];
  }

  switchTab(tab: "body" | "headers") {
    this.activeTab = tab;
    this.tabs.setSelectedIndex(tab === "body" ? 0 : 1);
    this.updateVisibility();
  }
}
