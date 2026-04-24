import type { CliRenderer, KeyEvent } from "@opentui/core";
import { createCliRenderer, BoxRenderable, TextRenderable, CliRenderEvents } from "@opentui/core";
import type { Theme, HistoryEntry, ApiResponse } from "./types";
import { themes, defaultTheme } from "./themes";
import { FocusManager } from "./focus-manager";
import { createFooter } from "./components/footer";
import { RequestPanel } from "./panels/request-panel";
import { ResponsePanel } from "./panels/response-panel";
import { HistoryPanel } from "./panels/history-panel";
import { MetricsPanel } from "./panels/metrics-panel";
import { sendRequest } from "./utils/request";
import { settingsStore } from "./utils/settings-store";
import { copyToClipboard } from "./utils/clipboard";
import { createThemeSelectorOverlay } from "./overlays/theme-selector";
import { createExportDialogOverlay } from "./overlays/export-dialog";
import { createKeymapPopupOverlay } from "./overlays/keymap-popup";
import { createMethodSelectorOverlay } from "./overlays/method-selector";
import { BodyEditorOverlay } from "./overlays/body-editor-popup";
import { HeaderEditorOverlay } from "./overlays/header-editor-popup";

export class PiperApp {
  renderer!: CliRenderer;
  theme: Theme = defaultTheme;
  themeName = "tokyoNight";
  focusManager = new FocusManager();

  // Layout nodes
  root!: BoxRenderable;
  body!: BoxRenderable;
  leftColumn!: BoxRenderable;
  rightColumn!: BoxRenderable;
  footer!: BoxRenderable;

  // Panels
  requestPanel!: RequestPanel;
  responsePanel!: ResponsePanel;
  historyPanel!: HistoryPanel;
  metricsPanel!: MetricsPanel;

  // Overlays
  themeSelectorOverlay?: BoxRenderable;
  exportDialogOverlay?: { overlay: BoxRenderable; getText: () => string };
  keymapPopupOverlay?: BoxRenderable;
  methodSelectorOverlay?: BoxRenderable;
  bodyEditorOverlay?: BodyEditorOverlay;
  headerEditorOverlay?: HeaderEditorOverlay;

  // State
  history: HistoryEntry[] = [];
  activeResponseTab = "body";
  loading = false;
  leftColumnVisible = true;

  private readonly MIN_TERM_WIDTH = 100;

  async init() {
    this.renderer = await createCliRenderer({ exitOnCtrlC: false, backgroundColor: "black", screenMode: "alternate-screen" });
    this.renderer.setBackgroundColor("black");

    const savedTheme = await settingsStore.getTheme();
    if (savedTheme && themes[savedTheme]) {
      this.theme = themes[savedTheme]!;
      this.themeName = savedTheme;
    }

    this.buildLayout();
    this.setupKeyboard();
    this.focusManager.focusByIndex(0);

    this.renderer.on(CliRenderEvents.RESIZE, () => this.handleResize());
    this.handleResize();
  }

  private buildLayout() {
    const r = this.renderer;
    const t = this.theme;

    this.root = new BoxRenderable(r, {
      id: "root",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      backgroundColor: "black",
      padding: 1,
      gap: 1,
    });

    // Body (row)
    this.body = new BoxRenderable(r, {
      id: "body",
      flexDirection: "row",
      flexGrow: 1,
      backgroundColor: "black",
      gap: 1,
    });

    // Left column (40%)
    this.leftColumn = new BoxRenderable(r, {
      id: "left-column",
      flexDirection: "column",
      width: "40%",
      backgroundColor: "black",
      gap: 1,
    });
    this.historyPanel = new HistoryPanel(r, t);
    this.historyPanel.onSelect = (entry) => this.loadHistoryEntry(entry);
    this.metricsPanel = new MetricsPanel(r, t);
    this.leftColumn.add(this.historyPanel.panel);
    this.leftColumn.add(this.metricsPanel.panel);

    // Right column (60%)
    this.rightColumn = new BoxRenderable(r, {
      id: "right-column",
      flexDirection: "column",
      flexGrow: 1,
      backgroundColor: "black",
      gap: 1,
    });
    this.requestPanel = new RequestPanel(r, t);
    this.requestPanel.onSend = () => this.handleSend();
    this.requestPanel.onSuggestionSelect = (entry) => this.loadHistoryEntry(entry);
    this.responsePanel = new ResponsePanel(r, t);
    this.rightColumn.add(this.requestPanel.panel);
    this.rightColumn.add(this.responsePanel.panel);

    this.body.add(this.leftColumn);
    this.body.add(this.rightColumn);

    // Footer
    this.footer = createFooter(r, t);

    this.root.add(this.body);
    this.root.add(this.footer);

    r.root.add(this.root);

    // Register focusables
    for (const f of this.requestPanel.getFocusables()) {
      this.focusManager.register(f);
    }
    for (const f of this.responsePanel.getFocusables()) {
      this.focusManager.register(f);
    }
    for (const f of this.historyPanel.getFocusables()) {
      this.focusManager.register(f);
    }
  }

  private handleResize() {
    const width = this.renderer.terminalWidth;
    const shouldShow = width >= this.MIN_TERM_WIDTH;

    if (shouldShow === this.leftColumnVisible) return;

    if (shouldShow) {
      this.body.insertBefore(this.leftColumn, this.rightColumn);
    } else {
      this.body.remove("left-column");
    }

    this.leftColumnVisible = shouldShow;
    this.renderer.requestRender();
  }

  private setupKeyboard() {
    this.renderer.keyInput.on("keypress", (key: KeyEvent) => {
      // Global keymap
      if (key.ctrl && key.name === "c") {
        this.renderer.destroy();
        return;
      }

      if (key.name === "escape") {
        if (this.keymapPopupOverlay) {
          this.closeKeymapPopup();
          return;
        }
        if (this.themeSelectorOverlay) {
          this.closeThemeSelector();
          return;
        }
        if (this.exportDialogOverlay) {
          this.closeExportDialog();
          return;
        }
        if (this.methodSelectorOverlay) {
          this.closeMethodSelector();
          return;
        }
        if (this.bodyEditorOverlay) {
          this.closeBodyEditor();
          return;
        }
        if (this.headerEditorOverlay) {
          this.closeHeaderEditor();
          return;
        }
        return;
      }

      // Global yank (copy selected text to clipboard)
      if (key.ctrl && key.name === "y") {
        this.yankSelectedText();
        return;
      }

      // Body editor keymap
      if (this.bodyEditorOverlay) {
        if (key.ctrl && key.name === "s") {
          this.bodyEditorOverlay.handleAddOrUpdate();
          return;
        }
        if (key.ctrl && key.name === "n") {
          this.bodyEditorOverlay.newEntry();
          return;
        }
        if (key.ctrl && key.name === "d") {
          this.bodyEditorOverlay.deleteSelected();
          return;
        }
        if (key.name === "tab") {
          if (key.shift) {
            this.bodyEditorOverlay.keyInput.focus();
          } else {
            this.bodyEditorOverlay.valueInput.focus();
          }
          return;
        }
        if (key.name === "right") {
          this.bodyEditorOverlay.valueInput.focus();
          return;
        }
        if (key.name === "left") {
          this.bodyEditorOverlay.keyInput.focus();
          return;
        }
        if (key.name === "up") {
          this.bodyEditorOverlay.navigate(-1);
          return;
        }
        if (key.name === "down") {
          this.bodyEditorOverlay.navigate(1);
          return;
        }
        if (key.name === "enter" || key.name === "return") {
          this.bodyEditorOverlay.editSelected();
          return;
        }
      }

      // Header editor keymap
      if (this.headerEditorOverlay) {
        if (key.ctrl && key.name === "s") {
          this.headerEditorOverlay.handleAddOrUpdate();
          return;
        }
        if (key.ctrl && key.name === "n") {
          this.headerEditorOverlay.newEntry();
          return;
        }
        if (key.ctrl && key.name === "d") {
          this.headerEditorOverlay.deleteSelected();
          return;
        }
        if (key.name === "tab") {
          if (key.shift) {
            this.headerEditorOverlay.keyInput.focus();
          } else {
            this.headerEditorOverlay.valueInput.focus();
          }
          return;
        }
        if (key.name === "right") {
          this.headerEditorOverlay.valueInput.focus();
          return;
        }
        if (key.name === "left") {
          this.headerEditorOverlay.keyInput.focus();
          return;
        }
        if (key.name === "up") {
          this.headerEditorOverlay.navigate(-1);
          return;
        }
        if (key.name === "down") {
          this.headerEditorOverlay.navigate(1);
          return;
        }
        if (key.name === "enter" || key.name === "return") {
          this.headerEditorOverlay.editSelected();
          return;
        }
      }

      // Tab navigation
      if (key.name === "tab") {
        if (key.shift) {
          this.focusManager.focusPrevious();
        } else {
          this.focusManager.focusNext();
        }
        return;
      }

      // Only process single-key keymap when no overlay is open
      if (this.themeSelectorOverlay || this.exportDialogOverlay || this.keymapPopupOverlay || this.methodSelectorOverlay || this.bodyEditorOverlay || this.headerEditorOverlay) return;

      if (key.ctrl && key.name === "/") {
        this.openKeymapPopup();
        return;
      }

      if (key.ctrl && key.name === "m") {
        this.openMethodSelector();
        return;
      }

      if (key.ctrl && key.name === "b") {
        this.openBodyEditor();
        return;
      }

      if (key.ctrl && key.name === "h") {
        this.openHeaderEditor();
        return;
      }

      if (key.ctrl && key.name === "u") {
        const url = this.requestPanel.getUrl();
        this.focusManager.focusByIndex(0);
        queueMicrotask(() => this.requestPanel.setUrl(url));
        return;
      }

      if (key.ctrl && key.name === "q") {
        this.renderer.destroy();
        return;
      }

      if (key.ctrl && key.name === "t") {
        this.openThemeSelector();
        return;
      }

      if (key.ctrl && key.name === "e") {
        this.openExportDialog();
        return;
      }

      if (key.ctrl && key.name === "return") {
        this.handleSend();
        return;
      }

      // History panel navigation when search is focused
      const currentFocus = this.focusManager.getCurrent();
      if (currentFocus === this.historyPanel.searchInput) {
        if (key.name === "up") {
          this.historyPanel.moveSelection(-1);
          return;
        }
        if (key.name === "down") {
          this.historyPanel.moveSelection(1);
          return;
        }
        if (key.name === "enter" || key.name === "return") {
          this.historyPanel.selectCurrent();
          return;
        }
      }

      // URL ghost suggestion when URL input is focused
      if (currentFocus === this.requestPanel.urlInput && this.requestPanel.ghostVisible) {
        if (key.name === "right") {
          this.requestPanel.acceptGhost();
          return;
        }
        if (key.name === "escape") {
          this.requestPanel.clearGhost();
          return;
        }
      }
    });
  }

  private loadHistoryEntry(entry: HistoryEntry) {
    this.requestPanel.setMethod(entry.method);
    this.requestPanel.setUrl(entry.url);
    this.requestPanel.setHeaders(
      typeof entry.headers === "object"
        ? JSON.stringify(entry.headers, null, 2)
        : (entry.headers ?? "")
    );
    this.requestPanel.setBody(
      typeof entry.body === "object"
        ? JSON.stringify(entry.body, null, 2)
        : (entry.body ?? "")
    );
  }

  private async handleSend() {
    if (this.loading) return;
    const method = this.requestPanel.getMethod();
    const url = this.requestPanel.getUrl();
    const headersStr = this.requestPanel.getHeaders();
    const bodyStr = this.requestPanel.getBody();

    if (!url) return;

    this.loading = true;
    this.responsePanel.setLoading(true);
    this.requestPanel.setSending(true);
    try {
      // Validate JSON but pass raw strings for env interpolation
      if (headersStr) JSON.parse(headersStr);
      if (bodyStr) JSON.parse(bodyStr);
    } catch (err: any) {
      this.responsePanel.setError(`Invalid JSON: ${err.message ?? String(err)}`);
      this.loading = false;
      this.responsePanel.setLoading(false);
      this.requestPanel.setSending(false);
      return;
    }

    try {
      const res = await sendRequest({ method, url, headers: headersStr, body: bodyStr });
      this.responsePanel.setResponse(res);
      this.metricsPanel.setMetrics(res.metrics);
      await this.historyPanel.addEntry({
        method,
        url,
        headers: headersStr,
        body: bodyStr,
        timestamp: Date.now(),
        responseStatus: res.status,
        responseTime: res.metrics.total,
      });
    } catch (err: any) {
      this.responsePanel.setError(err.message ?? String(err));
    } finally {
      this.loading = false;
      this.responsePanel.setLoading(false);
      this.requestPanel.setSending(false);
    }
  }

  private openThemeSelector() {
    if (this.themeSelectorOverlay) return;
    this.themeSelectorOverlay = createThemeSelectorOverlay(
      this.renderer,
      this.theme,
      this.themeName,
      (themeName) => {
        this.setTheme(themeName);
        this.closeThemeSelector();
      }
    );
    this.root.add(this.themeSelectorOverlay);
    this.renderer.requestRender();
  }

  private closeThemeSelector() {
    if (!this.themeSelectorOverlay) return;
    this.root.remove("theme-selector-overlay");
    this.themeSelectorOverlay = undefined;
    this.renderer.requestRender();
  }

  private openExportDialog() {
    if (this.exportDialogOverlay) return;
    this.exportDialogOverlay = createExportDialogOverlay(
      this.renderer,
      this.theme,
      {
        method: this.requestPanel.getMethod(),
        url: this.requestPanel.getUrl(),
        headers: this.requestPanel.getHeaders(),
        body: this.requestPanel.getBody(),
      },
      () => this.closeExportDialog()
    );
    this.root.add(this.exportDialogOverlay.overlay);
    this.renderer.requestRender();
  }

  private closeExportDialog() {
    if (!this.exportDialogOverlay) return;
    this.root.remove("export-dialog-overlay");
    this.exportDialogOverlay = undefined;
    this.renderer.requestRender();
  }

  private openKeymapPopup() {
    if (this.keymapPopupOverlay) return;
    this.keymapPopupOverlay = createKeymapPopupOverlay(
      this.renderer,
      this.theme,
      () => this.closeKeymapPopup()
    );
    this.root.add(this.keymapPopupOverlay);
    this.renderer.requestRender();
  }

  private closeKeymapPopup() {
    if (!this.keymapPopupOverlay) return;
    this.root.remove("keymap-popup-overlay");
    this.keymapPopupOverlay = undefined;
    this.renderer.requestRender();
  }

  private openMethodSelector() {
    if (this.methodSelectorOverlay) return;
    this.methodSelectorOverlay = createMethodSelectorOverlay(
      this.renderer,
      this.theme,
      this.requestPanel.getMethod(),
      (method) => {
        this.requestPanel.setMethod(method);
        this.closeMethodSelector();
      }
    );
    this.root.add(this.methodSelectorOverlay);
    this.renderer.requestRender();
  }

  private closeMethodSelector() {
    if (!this.methodSelectorOverlay) return;
    this.root.remove("method-selector-overlay");
    this.methodSelectorOverlay = undefined;
    this.renderer.requestRender();
  }

  private openBodyEditor() {
    if (this.bodyEditorOverlay) return;
    this.bodyEditorOverlay = new BodyEditorOverlay(
      this.renderer,
      this.theme,
      this.requestPanel.getBody()
    );
    this.root.add(this.bodyEditorOverlay.overlay);
    this.renderer.requestRender();
  }

  private closeBodyEditor() {
    if (!this.bodyEditorOverlay) return;
    this.requestPanel.setBody(this.bodyEditorOverlay.getBody());
    this.root.remove("body-editor-overlay");
    this.bodyEditorOverlay = undefined;
    this.renderer.requestRender();
  }

  private openHeaderEditor() {
    if (this.headerEditorOverlay) return;
    this.headerEditorOverlay = new HeaderEditorOverlay(
      this.renderer,
      this.theme,
      this.requestPanel.getHeaders()
    );
    this.root.add(this.headerEditorOverlay.overlay);
    this.renderer.requestRender();
  }

  private closeHeaderEditor() {
    if (!this.headerEditorOverlay) return;
    this.requestPanel.setHeaders(this.headerEditorOverlay.getHeaders());
    this.root.remove("header-editor-overlay");
    this.headerEditorOverlay = undefined;
    this.renderer.requestRender();
  }

  private yankSelectedText() {
    // 1. Export dialog: always copy the preview text
    if (this.exportDialogOverlay) {
      copyToClipboard(this.exportDialogOverlay.getText());
      return;
    }

    // 2. Check currently focused renderable for selection
    const focused = this.focusManager.getCurrent();
    if (focused) {
      const r = focused as any;
      if (typeof r.hasSelection === "function" && r.hasSelection()) {
        const text = r.getSelectedText?.();
        if (text) {
          copyToClipboard(text);
          this.renderer.clearSelection();
          this.renderer.requestRender();
          return;
        }
      }
    }

    // 3. Check other known renderables for selection
    const candidates = [
      this.requestPanel.urlInput,
      this.requestPanel.bodyPreview,
      this.requestPanel.headersPreview,
      this.responsePanel.bodyCode,
      this.responsePanel.headersCode,
    ];
    for (const r of candidates) {
      if (!r) continue;
      const candidate = r as any;
      if (typeof candidate.hasSelection === "function" && candidate.hasSelection()) {
        const text = candidate.getSelectedText?.();
        if (text) {
          copyToClipboard(text);
          this.renderer.clearSelection();
          this.renderer.requestRender();
          return;
        }
      }
    }
  }

  setTheme(themeName: string) {
    const theme = themes[themeName];
    if (!theme) return;
    this.theme = theme;
    this.themeName = themeName;

    settingsStore.setTheme(themeName);

    this.root.backgroundColor = "black";
    this.renderer.setBackgroundColor("black");

    const footerName = this.footer.getRenderable("footer-name") as TextRenderable | undefined;
    if (footerName) {
      footerName.fg = theme.colors.white;
    }
    const footerVersion = this.footer.getRenderable("footer-version") as TextRenderable | undefined;
    if (footerVersion) {
      footerVersion.fg = theme.colors.white;
    }
    const footerShortcutKey = this.footer.getRenderable("footer-shortcut-key") as TextRenderable | undefined;
    if (footerShortcutKey) {
      footerShortcutKey.fg = theme.colors.white;
    }
    const footerShortcutLabel = this.footer.getRenderable("footer-shortcut-label") as TextRenderable | undefined;
    if (footerShortcutLabel) {
      footerShortcutLabel.fg = theme.colors.white;
    }

    this.historyPanel.applyTheme(theme);
    this.metricsPanel.applyTheme(theme);
    this.requestPanel.applyTheme(theme);
    this.responsePanel.applyTheme(theme);

    this.renderer.requestRender();
  }
}
