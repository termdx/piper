import type { RenderContext } from "@opentui/core";
import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  RGBA,
  TextAttributes,
} from "@opentui/core";
import type { Theme } from "../types";
import { workspaceStore } from "../utils/workspace-store";
import { lightenColor } from "../utils/colors";

const POPUP_BG = "#1a1a1a";

export class WorkspaceManagerOverlay {
  overlay: BoxRenderable;
  nameInput: InputRenderable;
  addButton: BoxRenderable;
  addButtonText: TextRenderable;

  private workspaces: string[] = [];
  private selectedIndex = -1;
  private listContainer: BoxRenderable;
  private theme: Theme;
  private renderer: RenderContext;
  private rowIds: string[] = [];
  private isRenaming = false;
  onSwitch?: (name: string) => void;
  onDelete?: (name: string) => void;
  onClose?: () => void;

  constructor(renderer: RenderContext, theme: Theme, currentWorkspace?: string) {
    this.renderer = renderer;
    this.theme = theme;

    const urlBarBg = lightenColor(POPUP_BG, 12);

    this.overlay = new BoxRenderable(renderer, {
      id: "workspace-manager-overlay",
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      zIndex: 25,
    });

    const backdrop = new BoxRenderable(renderer, {
      id: "workspace-manager-backdrop",
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      backgroundColor: RGBA.fromValues(0, 0, 0, 0.55),
    });
    this.overlay.add(backdrop);

    const popup = new BoxRenderable(renderer, {
      id: "workspace-manager-popup",
      position: "absolute",
      left: "10%",
      top: "20%",
      width: "80%",
      height: "auto",
      backgroundColor: POPUP_BG,
      paddingX: 2,
      paddingY: 1,
      paddingBottom: 2,
      flexDirection: "column",
      gap: 1,
    });

    // Title row
    const titleRow = new BoxRenderable(renderer, {
      id: "workspace-manager-title-row",
      flexDirection: "row",
      justifyContent: "space-between",
      height: 1,
    });
    const title = new TextRenderable(renderer, {
      id: "workspace-manager-title",
      content: " manage workspaces ",
      fg: theme.colors.accent,
      attributes: TextAttributes.BOLD,
    });
    const escHint = new TextRenderable(renderer, {
      id: "workspace-manager-esc-hint",
      content: " esc ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
    });
    titleRow.add(title);
    titleRow.add(escHint);
    popup.add(titleRow);

    // Current workspace label
    if (currentWorkspace) {
      const currentLabel = new TextRenderable(renderer, {
        content: ` current: ${currentWorkspace} `,
        fg: theme.colors.cool,
        attributes: TextAttributes.DIM,
      });
      popup.add(currentLabel);
    }

    // Editor row (name input + add button)
    const editorRow = new BoxRenderable(renderer, {
      id: "workspace-editor-row",
      flexDirection: "row",
      gap: 1,
      height: 1,
    });

    this.nameInput = new InputRenderable(renderer, {
      id: "workspace-name-input",
      placeholder: "Workspace name",
      flexGrow: 1,
      backgroundColor: urlBarBg,
      textColor: theme.colors.white,
      cursorColor: theme.colors.accent,
      focusedBackgroundColor: theme.colors.muted,
    });

    this.addButton = new BoxRenderable(renderer, {
      id: "workspace-add-button",
      flexDirection: "row",
      backgroundColor: urlBarBg,
      paddingX: 2,
      paddingY: 0,
      alignItems: "center",
      justifyContent: "center",
      onMouseDown: () => this.handleAdd(),
    });
    this.addButtonText = new TextRenderable(renderer, {
      content: " + ",
      fg: theme.colors.accent,
      attributes: TextAttributes.BOLD,
    });
    this.addButton.add(this.addButtonText);

    editorRow.add(this.nameInput);
    editorRow.add(this.addButton);
    popup.add(editorRow);

    // List of workspaces
    this.listContainer = new BoxRenderable(renderer, {
      id: "workspace-list-container",
      flexDirection: "column",
      flexGrow: 1,
      gap: 0,
      overflow: "hidden",
    });
    popup.add(this.listContainer);

    // Keymap hint bar
    const hintRow = new BoxRenderable(renderer, {
      id: "workspace-manager-hint-row",
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
    addHint("ctrl+n", "create");
    addHint("ctrl+r", "rename");
    addHint("ctrl+d", "delete");
    addHint("ctrl+enter", "switch");
    addHint("enter", "confirm");
    addHint("↑↓", "navigate");
    addHint("esc", "close");
    popup.add(hintRow);

    this.overlay.add(popup);
    this.loadWorkspaces();
    this.nameInput.focus();
  }

  private async loadWorkspaces() {
    this.workspaces = await workspaceStore.listWorkspaces();
    this.selectedIndex = this.workspaces.length > 0 ? 0 : -1;
    this.renderList();
  }

  private renderList() {
    for (const id of this.rowIds) {
      this.listContainer.remove(id);
    }
    this.rowIds = [];

    if (this.workspaces.length === 0) {
      const empty = new TextRenderable(this.renderer, {
        id: "workspace-list-empty",
        content: "No workspaces yet",
        fg: this.theme.colors.muted,
        attributes: TextAttributes.DIM,
      });
      this.listContainer.add(empty);
      this.rowIds.push("workspace-list-empty");
      return;
    }

    for (let i = 0; i < this.workspaces.length; i++) {
      const name = this.workspaces[i]!;
      const isSelected = i === this.selectedIndex;
      const row = new BoxRenderable(this.renderer, {
        id: `workspace-row-${name}`,
        flexDirection: "row",
        gap: 1,
        paddingX: 1,
        paddingY: 0,
        height: 1,
        backgroundColor: isSelected ? lightenColor(POPUP_BG, 12) : undefined,
        onMouseDown: () => {
          this.selectedIndex = i;
          this.renderList();
        },
      });

      const nameText = new TextRenderable(this.renderer, {
        content: name,
        fg: isSelected ? this.theme.colors.accent : this.theme.colors.white,
        attributes: isSelected ? TextAttributes.BOLD : 0,
        flexGrow: 1,
      });

      const delBtn = new BoxRenderable(this.renderer, {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        width: 3,
        onMouseDown: (e) => {
          e?.stopPropagation?.();
          this.deleteWorkspace(name);
        },
      });
      const delText = new TextRenderable(this.renderer, {
        content: " × ",
        fg: this.theme.colors.error,
      });
      delBtn.add(delText);

      row.add(nameText);
      row.add(delBtn);
      this.listContainer.add(row);
      this.rowIds.push(row.id ?? "");
    }
  }

  handleAdd() {
    const name = this.nameInput.value?.trim();
    if (!name) return;
    workspaceStore.createWorkspace(name).then((ok) => {
      if (ok) {
        this.nameInput.value = "";
        this.loadWorkspaces();
      }
    });
  }

  navigate(delta: number) {
    if (this.workspaces.length === 0) return;
    this.selectedIndex = Math.max(0, Math.min(this.workspaces.length - 1, this.selectedIndex + delta));
    this.renderList();
  }

  switchSelected() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.workspaces.length) {
      const name = this.workspaces[this.selectedIndex]!;
      this.onSwitch?.(name);
    }
  }

  deleteSelected() {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.workspaces.length) return;
    const name = this.workspaces[this.selectedIndex]!;
    this.deleteWorkspace(name);
  }

  private deleteWorkspace(name: string) {
    workspaceStore.deleteWorkspace(name).then(() => {
      this.onDelete?.(name);
      this.loadWorkspaces();
    });
  }

  startRename() {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.workspaces.length) return;
    const oldName = this.workspaces[this.selectedIndex]!;
    this.nameInput.value = oldName;
    this.nameInput.focus();
    this.isRenaming = true;
    this.addButtonText.content = " ✓ ";
    this.addButtonText.fg = this.theme.colors.success;
  }

  handleRenameOrAdd() {
    if (this.isRenaming) {
      const newName = this.nameInput.value?.trim();
      if (newName && this.selectedIndex >= 0) {
        const oldName = this.workspaces[this.selectedIndex]!;
        workspaceStore.renameWorkspace(oldName, newName).then((ok) => {
          if (ok) {
            this.nameInput.value = "";
            this.isRenaming = false;
            this.addButtonText.content = " + ";
            this.addButtonText.fg = this.theme.colors.accent;
            this.loadWorkspaces();
          }
        });
      }
    } else {
      this.handleAdd();
    }
  }

}
