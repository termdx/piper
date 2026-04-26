import { CodeRenderable, StyledText } from "@opentui/core";
import type { Theme } from "../types";
import { highlightJson } from "./json-highlight";

export function setCodeStyledText(code: CodeRenderable, content: string, theme: Theme) {
  const styled = highlightJson(content, theme);
  const c = code as any;
  c.textBuffer.setStyledText(styled);
  c._shouldRenderTextBuffer = true;
  c.updateTextInfo();
  code.requestRender();
}
