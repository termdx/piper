import type { RenderContext } from "@opentui/core";
import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  RGBA,
  TextAttributes,
} from "@opentui/core";
import type { Theme } from "../types";

const POPUP_BG = "#1a1a1a";

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
  const b = Math.min(255, (num & 0x0000ff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export class BodyEditorOverlay {
  overlay: BoxRenderable;
  keyInput: InputRenderable;
  valueInput: InputRenderable;
  addButton: BoxRenderable;
  addButtonText: TextRenderable;
  deleteButton: BoxRenderable;

  private bodyData: Record<string, string> = {};
  private selectedKey: string | null = null;
  private navIndex = -1;
  private listContainer: BoxRenderable;
  private theme: Theme;
  private renderer: RenderContext;

  constructor(renderer: RenderContext, theme: Theme, body: string) {
    this.renderer = renderer;
    this.theme = theme;

    try {
      if (body.trim()) {
        this.bodyData = JSON.parse(body) as Record<string, string>;
      }
    } catch {
      this.bodyData = {};
    }

    const urlBarBg = lightenColor(POPUP_BG, 12);

    this.overlay = new BoxRenderable(renderer, {
      id: "body-editor-overlay",
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      zIndex: 10,
    });

    const backdrop = new BoxRenderable(renderer, {
      id: "body-editor-backdrop",
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      backgroundColor: RGBA.fromValues(0, 0, 0, 0.55),
    });
    this.overlay.add(backdrop);

    const popup = new BoxRenderable(renderer, {
      id: "body-editor-popup",
      position: "absolute",
      left: "15%",
      top: "15%",
      width: "70%",
      height: "70%",
      backgroundColor: POPUP_BG,
      paddingX: 2,
      paddingY: 1,
      paddingBottom: 2,
      flexDirection: "column",
      gap: 1,
    });

    // Title row
    const titleRow = new BoxRenderable(renderer, {
      id: "body-editor-title-row",
      flexDirection: "row",
      justifyContent: "space-between",
      height: 1,
    });
    const title = new TextRenderable(renderer, {
      id: "body-editor-title",
      content: " edit body ",
      fg: theme.colors.accent,
      attributes: TextAttributes.BOLD,
    });
    const escHint = new TextRenderable(renderer, {
      id: "body-editor-esc-hint",
      content: " esc ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
    });
    titleRow.add(title);
    titleRow.add(escHint);
    popup.add(titleRow);

    // Editor row
    const editorLabel = new TextRenderable(renderer, {
      content: " key / value ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
    });
    popup.add(editorLabel);

    const editorRow = new BoxRenderable(renderer, {
      id: "body-editor-row",
      flexDirection: "row",
      gap: 1,
      height: 1,
    });

    this.keyInput = new InputRenderable(renderer, {
      id: "body-key-input",
      placeholder: "Key",
      width: 20,
      backgroundColor: urlBarBg,
      textColor: theme.colors.white,
      cursorColor: theme.colors.accent,
      focusedBackgroundColor: theme.colors.muted,
    });

    this.valueInput = new InputRenderable(renderer, {
      id: "body-value-input",
      placeholder: "Value",
      flexGrow: 1,
      backgroundColor: urlBarBg,
      textColor: theme.colors.white,
      cursorColor: theme.colors.accent,
      focusedBackgroundColor: theme.colors.muted,
    });

    this.addButton = new BoxRenderable(renderer, {
      id: "body-add-button",
      flexDirection: "row",
      backgroundColor: urlBarBg,
      paddingX: 2,
      paddingY: 0,
      alignItems: "center",
      justifyContent: "center",
      onMouseDown: () => this.handleAddOrUpdate(),
    });
    this.addButtonText = new TextRenderable(renderer, {
      content: " + ",
      fg: theme.colors.accent,
      attributes: TextAttributes.BOLD,
    });
    this.addButton.add(this.addButtonText);

    this.deleteButton = new BoxRenderable(renderer, {
      id: "body-delete-button",
      flexDirection: "row",
      backgroundColor: urlBarBg,
      paddingX: 2,
      paddingY: 0,
      alignItems: "center",
      justifyContent: "center",
      onMouseDown: () => this.handleDelete(),
    });
    const deleteButtonText = new TextRenderable(renderer, {
      content: " × ",
      fg: theme.colors.error,
      attributes: TextAttributes.BOLD,
    });
    this.deleteButton.add(deleteButtonText);
    this.deleteButton.visible = false;

    editorRow.add(this.keyInput);
    editorRow.add(this.valueInput);
    editorRow.add(this.addButton);
    editorRow.add(this.deleteButton);
    popup.add(editorRow);

    // List of body fields (grows below the editor)
    this.listContainer = new BoxRenderable(renderer, {
      id: "body-list-container",
      flexDirection: "column",
      flexGrow: 1,
      gap: 0,
      overflow: "hidden",
    });
    popup.add(this.listContainer);

    // Keymap hint bar (bottom-center)
    const hintRow = new BoxRenderable(renderer, {
      id: "body-editor-hint-row",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      height: 1,
      gap: 2,
    });
    const addHint = (shortcut: string, label: string) => {
      const group = new BoxRenderable(renderer, {
        flexDirection: "row",
        gap: 0,
      });
      group.add(new TextRenderable(renderer, { content: shortcut, fg: theme.colors.white }));
      group.add(new TextRenderable(renderer, { content: ` ${label}`, fg: theme.colors.white, attributes: TextAttributes.DIM }));
      hintRow.add(group);
    };
    addHint("ctrl+s", "save");
    addHint("ctrl+n", "new");
    addHint("ctrl+d", "delete");
    addHint("<- ->", "navigate");
    addHint("up/down", "cycle");
    addHint("enter", "edit");
    addHint("esc", "close");
    popup.add(hintRow);

    this.overlay.add(popup);
    this.renderList();
    this.keyInput.focus();
  }

  private rowIds: string[] = [];

  private renderList() {
    // Remove old rows
    for (const id of this.rowIds) {
      this.listContainer.remove(id);
    }
    this.rowIds = [];

    const keys = Object.keys(this.bodyData);
    if (keys.length === 0) {
      const empty = new TextRenderable(this.renderer, {
        id: "body-list-empty",
        content: "No fields added",
        fg: this.theme.colors.muted,
        attributes: TextAttributes.DIM,
      });
      this.listContainer.add(empty);
      this.rowIds.push("body-list-empty");
      return;
    }

    for (const key of keys) {
      const isSelected = key === this.selectedKey;
      const row = new BoxRenderable(this.renderer, {
        id: `body-row-${key}`,
        flexDirection: "row",
        gap: 1,
        paddingX: 1,
        paddingY: 0,
        height: 1,
        backgroundColor: isSelected ? lightenColor(POPUP_BG, 12) : undefined,
        onMouseDown: () => this.selectRow(key),
      });

      const keyText = new TextRenderable(this.renderer, {
        content: key,
        fg: isSelected ? this.theme.colors.accent : this.theme.colors.primary,
        attributes: isSelected ? TextAttributes.BOLD : 0,
        width: 20,
      });

      const valueText = new TextRenderable(this.renderer, {
        content: this.bodyData[key] ?? "",
        fg: this.theme.colors.white,
        flexGrow: 1,
      });

      const delBtn = new BoxRenderable(this.renderer, {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        width: 3,
        onMouseDown: (e) => {
          e?.stopPropagation?.();
          this.deleteKey(key);
        },
      });
      const delText = new TextRenderable(this.renderer, {
        content: " × ",
        fg: this.theme.colors.error,
      });
      delBtn.add(delText);

      row.add(keyText);
      row.add(valueText);
      row.add(delBtn);
      this.listContainer.add(row);
      this.rowIds.push(row.id ?? "");
    }
  }

  private selectRow(key: string) {
    const keys = Object.keys(this.bodyData);
    this.navIndex = keys.indexOf(key);
    this.selectedKey = key;
    this.keyInput.value = key;
    this.valueInput.value = this.bodyData[key] ?? "";
    this.addButtonText.content = " ✓ ";
    this.addButtonText.fg = this.theme.colors.success;
    this.deleteButton.visible = true;
    this.renderList();
  }

  newEntry() {
    // Save current key/value first
    const currentKey = this.keyInput.value?.trim();
    if (currentKey) {
      this.handleAddOrUpdate();
    }

    this.selectedKey = null;
    this.navIndex = -1;
    this.keyInput.value = "";
    this.valueInput.value = "";
    this.addButtonText.content = " + ";
    this.addButtonText.fg = this.theme.colors.accent;
    this.deleteButton.visible = false;
    this.renderList();
    this.keyInput.focus();
  }

  navigate(delta: number) {
    const keys = Object.keys(this.bodyData);
    if (keys.length === 0) return;

    if (this.navIndex < 0) {
      this.navIndex = delta > 0 ? 0 : keys.length - 1;
    } else {
      this.navIndex = Math.max(0, Math.min(keys.length - 1, this.navIndex + delta));
    }

    const key = keys[this.navIndex]!;
    this.selectedKey = key;
    this.keyInput.value = key;
    this.valueInput.value = this.bodyData[key] ?? "";
    this.addButtonText.content = " ✓ ";
    this.addButtonText.fg = this.theme.colors.success;
    this.deleteButton.visible = true;
    this.renderList();
  }

  editSelected() {
    if (this.selectedKey) {
      this.valueInput.focus();
    }
  }

  deleteSelected() {
    if (this.selectedKey) {
      this.deleteKey(this.selectedKey);
    }
  }

  handleAddOrUpdate() {
    const key = this.keyInput.value?.trim();
    const value = this.valueInput.value ?? "";
    if (!key) return;

    if (this.selectedKey && this.selectedKey !== key) {
      delete this.bodyData[this.selectedKey];
    }
    this.bodyData[key] = value;

    this.selectedKey = null;
    this.keyInput.value = "";
    this.valueInput.value = "";
    this.addButtonText.content = " + ";
    this.addButtonText.fg = this.theme.colors.accent;
    this.deleteButton.visible = false;
    this.renderList();
    this.keyInput.focus();
  }

  private handleDelete() {
    if (this.selectedKey) {
      this.deleteKey(this.selectedKey);
    }
  }

  private deleteKey(key: string) {
    delete this.bodyData[key];
    if (this.selectedKey === key) {
      this.selectedKey = null;
      this.keyInput.value = "";
      this.valueInput.value = "";
      this.addButtonText.content = " + ";
      this.addButtonText.fg = this.theme.colors.accent;
      this.deleteButton.visible = false;
    }
    this.renderList();
  }

  getBody(): string {
    return JSON.stringify(this.bodyData, null, 2);
  }
}
