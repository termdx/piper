import type { RenderContext } from "@opentui/core";
import { BoxRenderable, TextRenderable, TextAttributes } from "@opentui/core";
import type { Theme } from "../types";

// "piper" in Classy font from patorjk.com
// Uses half-blocks (▀, ▄) + full blocks (█) for gapless pixel art
const ASCII_ART = [
  "       ▀▀             ▄    ",
  " ████▄ ██ ████▄ ▄█▀█▄ ████▄",
  " ██ ██ ██ ██ ██ ██▄█▀ ██   ",
  "▄████▀▄██▄████▀▄▀█▄▄▄▄█▀   ",
  " ██       ██               ",
  " ▀        ▀                ",
];
const LOGO_WIDTH = 28;

export function createWorkspaceSplashOverlay(
  renderer: RenderContext,
  theme: Theme,
  onManageWorkspaces: () => void,
) {
  const overlay = new BoxRenderable(renderer, {
    id: "workspace-splash-overlay",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: 20,
    backgroundColor: "black",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  });

  // Brand ASCII art (lines 0-4)
  for (let i = 0; i < ASCII_ART.length - 1; i++) {
    const artLine = new TextRenderable(renderer, {
      content: ASCII_ART[i]!,
      fg: theme.colors.accent,
      attributes: TextAttributes.BOLD,
    });
    overlay.add(artLine);
  }

  // Last line of logo
  const logoLastLine = new TextRenderable(renderer, {
    content: ASCII_ART[ASCII_ART.length - 1]!,
    fg: theme.colors.accent,
    attributes: TextAttributes.BOLD,
  });
  overlay.add(logoLastLine);

  // Spacer
  overlay.add(new TextRenderable(renderer, { content: " " }));

  // Subtitle
  const subtitle = new TextRenderable(renderer, {
    content: "Select a workspace to begin",
    fg: theme.colors.muted,
    attributes: TextAttributes.DIM,
  });
  overlay.add(subtitle);

  // Hint row
  const hintRow = new BoxRenderable(renderer, {
    flexDirection: "row",
    gap: 2,
    marginTop: 1,
  });

  const shortcutKey = new TextRenderable(renderer, {
    content: "ctrl+w",
    fg: theme.colors.white,
  });
  const shortcutLabel = new TextRenderable(renderer, {
    content: " select/create a workspace",
    fg: theme.colors.white,
    attributes: TextAttributes.DIM,
  });

  hintRow.add(shortcutKey);
  hintRow.add(shortcutLabel);
  overlay.add(hintRow);

  // Version tag — bottom right, same position as footer
  const versionTag = new TextRenderable(renderer, {
    content: "v0.1.6",
    fg: theme.colors.white,
    attributes: TextAttributes.DIM,
  });
  (versionTag as any).position = "absolute";
  (versionTag as any).bottom = 1;
  (versionTag as any).right = 2;
  overlay.add(versionTag);

  overlay.onMouseDown = () => onManageWorkspaces();

  return overlay;
}
