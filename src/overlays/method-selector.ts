import type { RenderContext } from "@opentui/core";
import { BoxRenderable, TextRenderable, SelectRenderable, TextAttributes, RGBA } from "@opentui/core";
import type { Theme } from "../types";
import { lightenColor } from "../utils/colors";

const POPUP_BG = "#1a1a1a";
const LIST_BG = "#1a1a1a";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];

export function createMethodSelectorOverlay(
  renderer: RenderContext,
  theme: Theme,
  currentMethod: string,
  onSelect: (method: string) => void
) {
  const overlay = new BoxRenderable(renderer, {
    id: "method-selector-overlay",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: 10,
  });

  const backdrop = new BoxRenderable(renderer, {
    id: "method-selector-backdrop",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    backgroundColor: RGBA.fromValues(0, 0, 0, 0.55),
  });
  overlay.add(backdrop);

  const urlBarBg = lightenColor(POPUP_BG, 12);

  const popup = new BoxRenderable(renderer, {
    id: "method-selector-popup",
    position: "absolute",
    left: "35%",
    top: "35%",
    width: "30%",
    height: "auto",
    backgroundColor: POPUP_BG,
    paddingX: 2,
    paddingY: 1,
    paddingBottom: 2,
    flexDirection: "column",
    gap: 1,
  });

  const title = new TextRenderable(renderer, {
    id: "method-selector-title",
    content: "select method",
    fg: theme.colors.accent,
    attributes: TextAttributes.BOLD,
  });
  popup.add(title);

  const currentIndex = HTTP_METHODS.indexOf(currentMethod.toUpperCase());
  const select = new SelectRenderable(renderer, {
    id: "method-select-popup",
    options: HTTP_METHODS.map((m) => ({
      name: m,
      description: "",
      value: m,
    })),
    selectedIndex: currentIndex >= 0 ? currentIndex : 0,
    height: 10,
    backgroundColor: LIST_BG,
    textColor: theme.colors.white,
    selectedBackgroundColor: urlBarBg,
    selectedTextColor: theme.colors.accent,
  });

  select.on("itemSelected", (_idx, option) => {
    if (option?.value) onSelect(option.value);
  });
  select.focus();

  popup.add(select);

  // Keymap hint bar (bottom-center)
  const hintRow = new BoxRenderable(renderer, {
    id: "method-selector-hint-row",
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
  addHint("↑↓", "navigate");
  addHint("enter", "select");
  addHint("esc", "close");
  popup.add(hintRow);

  overlay.add(popup);
  return overlay;
}
