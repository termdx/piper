import type { RenderContext } from "@opentui/core";
import { BoxRenderable, TextRenderable, TabSelectRenderable, TextAttributes, RGBA } from "@opentui/core";
import type { Theme } from "../types";

// Fixed popup background — independent of the app theme
const POPUP_BG = "#1a1a1a";

function toCurl(request: { method: string; url: string; headers: string; body: string }): string {
  let cmd = `curl -X ${request.method} "${request.url}"`;
  try {
    const headers = JSON.parse(request.headers || "{}") as Record<string, string>;
    for (const [k, v] of Object.entries(headers)) {
      cmd += ` \\\n  -H "${k}: ${v}"`;
    }
  } catch {
    // ignore
  }
  if (request.body) {
    cmd += ` \\\n  -d '${request.body}'`;
  }
  return cmd;
}

function toFetch(request: { method: string; url: string; headers: string; body: string }): string {
  let code = `fetch("${request.url}", {\n  method: "${request.method}"`;
  try {
    const headers = JSON.parse(request.headers || "{}") as Record<string, string>;
    code += `,\n  headers: ${JSON.stringify(headers, null, 2)}`;
  } catch {
    // ignore
  }
  if (request.body) {
    code += `,\n  body: JSON.stringify(${request.body})`;
  }
  code += `\n});`;
  return code;
}

export function createExportDialogOverlay(
  renderer: RenderContext,
  theme: Theme,
  request: { method: string; url: string; headers: string; body: string },
  onClose: () => void
) {
  // Full-screen parent
  const overlay = new BoxRenderable(renderer, {
    id: "export-dialog-overlay",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: 10,
  });

  // Dimming backdrop
  const backdrop = new BoxRenderable(renderer, {
    id: "export-dialog-backdrop",
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
    id: "export-dialog-popup",
    position: "absolute",
    left: "10%",
    top: "20%",
    width: "80%",
    height: "60%",
    backgroundColor: POPUP_BG,
    paddingX: 2,
    paddingY: 1,
    flexDirection: "column",
    gap: 1,
  });

  const title = new TextRenderable(renderer, {
    id: "export-dialog-title",
    content: "export request",
    fg: theme.colors.accent,
    attributes: TextAttributes.BOLD,
  });
  popup.add(title);

  // Format tabs
  const formatTabs = new TabSelectRenderable(renderer, {
    id: "export-format-tabs",
    options: [
      { name: "cURL", description: "", value: "curl" },
      { name: "Fetch", description: "", value: "fetch" },
    ],
    tabWidth: 12,
    showDescription: false,
    showUnderline: true,
  });
  formatTabs.focus();
  popup.add(formatTabs);

  // Preview
  const previewBox = new BoxRenderable(renderer, {
    id: "export-preview-box",
    backgroundColor: POPUP_BG,
    padding: 1,
    flexGrow: 1,
    overflow: "hidden",
  });

  const previewText = new TextRenderable(renderer, {
    id: "export-preview-text",
    content: toCurl(request),
    fg: theme.colors.white,
  });
  previewBox.add(previewText);
  popup.add(previewBox);

  let currentFormat: "curl" | "fetch" = "curl";

  const updatePreview = () => {
    previewText.content = currentFormat === "curl" ? toCurl(request) : toFetch(request);
  };

  formatTabs.on("selectionChanged", (_idx, option) => {
    currentFormat = option?.value ?? "curl";
    updatePreview();
  });

  // Keymap hint bar (bottom-center)
  const hintRow = new BoxRenderable(renderer, {
    id: "export-dialog-hint-row",
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
  addHint("ctrl+y", "yank");
  addHint("esc", "close");
  popup.add(hintRow);

  overlay.add(popup);

  return {
    overlay,
    getText: () => currentFormat === "curl" ? toCurl(request) : toFetch(request),
  };
}
