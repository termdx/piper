import type { RenderContext } from "@opentui/core";
import { BoxRenderable, TextRenderable, TextAttributes } from "@opentui/core";
import type { Theme } from "../types";

export function createFooter(renderer: RenderContext, theme: Theme) {
  const footer = new BoxRenderable(renderer, {
    id: "footer",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "black",
    paddingX: 1,
    height: 1,
  });

  const leftGroup = new BoxRenderable(renderer, {
    id: "footer-left-group",
    flexDirection: "row",
    gap: 0,
  });

  const nameText = new TextRenderable(renderer, {
    id: "footer-name",
    content: "piper",
    fg: theme.colors.white,
  });

  const versionText = new TextRenderable(renderer, {
    id: "footer-version",
    content: " v0.0.1",
    fg: theme.colors.white,
    attributes: TextAttributes.DIM,
  });

  leftGroup.add(nameText);
  leftGroup.add(versionText);

  const rightGroup = new BoxRenderable(renderer, {
    id: "footer-right-group",
    flexDirection: "row",
    gap: 0,
  });

  const shortcutKeyText = new TextRenderable(renderer, {
    id: "footer-shortcut-key",
    content: "ctrl+/",
    fg: theme.colors.white,
  });

  const shortcutLabelText = new TextRenderable(renderer, {
    id: "footer-shortcut-label",
    content: " keymap",
    fg: theme.colors.white,
    attributes: TextAttributes.DIM,
  });

  rightGroup.add(shortcutKeyText);
  rightGroup.add(shortcutLabelText);

  footer.add(leftGroup);
  footer.add(rightGroup);
  return footer;
}
