import type { RenderContext } from "@opentui/core";
import { BoxRenderable, TextRenderable, TextAttributes, RGBA } from "@opentui/core";
import type { Theme } from "../types";

// Fixed popup background — independent of the app theme
const POPUP_BG = "#1a1a1a";

interface Command {
  name: string;
  shortcut: string;
}

interface CommandCategory {
  title: string;
  color: string;
  commands: Command[];
}

const CATEGORIES: CommandCategory[] = [
  {
    title: "general",
    color: "accent",
    commands: [
      { name: "quit", shortcut: "ctrl+q" },
      { name: "open commands", shortcut: "ctrl+/" },
      { name: "change theme", shortcut: "ctrl+t" },
      { name: "export request", shortcut: "ctrl+e" },
      { name: "yank selected text", shortcut: "ctrl+y" },
    ],
  },
  {
    title: "request",
    color: "primary",
    commands: [
      { name: "send request", shortcut: "ctrl+enter" },
      { name: "switch method", shortcut: "ctrl+m" },
      { name: "jump to url", shortcut: "ctrl+u" },
      { name: "edit body", shortcut: "ctrl+b" },
      { name: "edit headers", shortcut: "ctrl+h" },
    ],
  },
  {
    title: "response",
    color: "success",
    commands: [
      { name: "switch response tabs", shortcut: "tab → tabs" },
    ],
  },
  {
    title: "navigation",
    color: "secondary",
    commands: [
      { name: "next focus", shortcut: "tab" },
      { name: "previous focus", shortcut: "shift+tab" },
      { name: "history up", shortcut: "up" },
      { name: "history down", shortcut: "down" },
      { name: "select history item", shortcut: "enter" },
    ],
  },
];

function formatShortcut(shortcut: string): string {
  return shortcut
    .replace(/shift\+/g, "⇧+")
    .replace(/enter/g, "↵");
}

export function createKeymapPopupOverlay(renderer: RenderContext, theme: Theme, onClose: () => void) {
  // Full-screen parent
  const overlay = new BoxRenderable(renderer, {
    id: "keymap-popup-overlay",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: 10,
  });

  // Dimming backdrop
  const backdrop = new BoxRenderable(renderer, {
    id: "keymap-backdrop",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    backgroundColor: RGBA.fromValues(0, 0, 0, 0.55),
  });
  overlay.add(backdrop);

  // Popup content panel
  const popup = new BoxRenderable(renderer, {
    id: "keymap-popup",
    position: "absolute",
    left: "25%",
    top: "20%",
    width: "50%",
    height: "55%",
    backgroundColor: POPUP_BG,
    paddingX: 2,
    paddingY: 1,
    flexDirection: "column",
    gap: 0,
  });

  // Title row
  const titleRow = new BoxRenderable(renderer, {
    id: "keymap-title-row",
    flexDirection: "row",
    justifyContent: "space-between",
    height: 1,
  });
  const title = new TextRenderable(renderer, {
    id: "keymap-title",
    content: " keymap ",
    fg: theme.colors.accent,
    attributes: TextAttributes.BOLD,
  });
  const escGroup = new BoxRenderable(renderer, {
    id: "keymap-esc-group",
    flexDirection: "row",
    gap: 0,
  });
  escGroup.add(new TextRenderable(renderer, {
    id: "keymap-esc-key",
    content: "esc",
    fg: theme.colors.white,
  }));
  escGroup.add(new TextRenderable(renderer, {
    id: "keymap-esc-label",
    content: " close",
    fg: theme.colors.white,
    attributes: TextAttributes.DIM,
  }));
  titleRow.add(title);
  titleRow.add(escGroup);
  popup.add(titleRow);

  // Categories
  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i]!;
    const catColor = theme.colors[category.color as keyof typeof theme.colors] ?? theme.colors.white;

    const catTitle = new TextRenderable(renderer, {
      content: ` ${category.title} `,
      fg: catColor,
      attributes: TextAttributes.BOLD,
    });
    if (i > 0) {
      catTitle.marginTop = 1;
    }
    popup.add(catTitle);

    for (const cmd of category.commands) {
      const row = new BoxRenderable(renderer, {
        flexDirection: "row",
        justifyContent: "space-between",
        height: 1,
        paddingX: 1,
      });

      const nameText = new TextRenderable(renderer, {
        content: cmd.name,
        fg: theme.colors.white,
      });
      const shortcutText = new TextRenderable(renderer, {
        content: formatShortcut(cmd.shortcut),
        fg: theme.colors.muted,
        attributes: TextAttributes.DIM,
      });

      row.add(nameText);
      row.add(shortcutText);
      popup.add(row);
    }
  }

  overlay.add(popup);
  return overlay;
}
