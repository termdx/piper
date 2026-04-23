import type { RenderContext } from "@opentui/core";
import { BoxRenderable, TextRenderable, SelectRenderable, TextAttributes, RGBA } from "@opentui/core";
import type { Theme } from "../types";
import { themes } from "../themes";

// Fixed popup background — independent of the app theme
const POPUP_BG = "#1a1a1a";
const LIST_BG = "#1a1a1a";

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
  const b = Math.min(255, (num & 0x0000ff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function createThemeSelectorOverlay(
  renderer: RenderContext,
  theme: Theme,
  currentThemeName: string,
  onSelect: (themeName: string) => void
) {
  // Full-screen parent
  const overlay = new BoxRenderable(renderer, {
    id: "theme-selector-overlay",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: 10,
  });

  // Dimming backdrop
  const backdrop = new BoxRenderable(renderer, {
    id: "theme-selector-backdrop",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    backgroundColor: RGBA.fromValues(0, 0, 0, 0.55),
  });
  overlay.add(backdrop);

  const urlBarBg = lightenColor(POPUP_BG, 12);

  // Popup content panel
  const popup = new BoxRenderable(renderer, {
    id: "theme-selector-popup",
    position: "absolute",
    left: "25%",
    top: "30%",
    width: "50%",
    height: "auto",
    backgroundColor: POPUP_BG,
    paddingX: 2,
    paddingY: 1,
    paddingBottom: 2,
    flexDirection: "column",
    gap: 1,
  });

  const title = new TextRenderable(renderer, {
    id: "theme-selector-title",
    content: "select theme",
    fg: theme.colors.accent,
    attributes: TextAttributes.BOLD,
  });
  popup.add(title);

  const themeNames = Object.keys(themes);
  const selectedIndex = themeNames.indexOf(currentThemeName);
  const select = new SelectRenderable(renderer, {
    id: "theme-select",
    options: themeNames.map((name) => ({
      name: themes[name]!.name,
      description: "",
      value: name,
    })),
    selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
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
    id: "theme-selector-hint-row",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: 1,
    gap: 2,
  });
  const escGroup = new BoxRenderable(renderer, {
    flexDirection: "row",
    gap: 0,
  });
  escGroup.add(new TextRenderable(renderer, { content: "esc", fg: theme.colors.white }));
  escGroup.add(new TextRenderable(renderer, { content: " close", fg: theme.colors.white, attributes: TextAttributes.DIM }));
  hintRow.add(escGroup);
  popup.add(hintRow);

  overlay.add(popup);
  return overlay;
}
