import { RGBA, StyledText } from "@opentui/core";
import type { TextChunk } from "@opentui/core";
import type { Theme } from "../types";

type TokenType = "whitespace" | "punctuation" | "string" | "envvar" | "number" | "keyword" | "plain";

interface Token {
  type: TokenType;
  text: string;
  isKey?: boolean;
}

function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = json.length;

  // Stack tracks whether we're inside an object that expects a key next
  const stack: { type: "object" | "array"; expectKey: boolean }[] = [];
  let expectKey = false;

  while (i < len) {
    const char = json.charAt(i);

    // Whitespace
    if (/\s/.test(char)) {
      let text = "";
      while (i < len && /\s/.test(json.charAt(i))) {
        text += json.charAt(i);
        i++;
      }
      tokens.push({ type: "whitespace", text });
      continue;
    }

    // Punctuation
    if (/[{}[\]:,]/.test(char)) {
      if (char === "{") {
        stack.push({ type: "object", expectKey: true });
        expectKey = true;
      } else if (char === "[") {
        stack.push({ type: "array", expectKey: false });
        expectKey = false;
      } else if (char === "}" || char === "]") {
        stack.pop();
        expectKey = stack.length > 0 ? stack[stack.length - 1]!.expectKey : false;
      } else if (char === ":") {
        expectKey = false;
        if (stack.length > 0) stack[stack.length - 1]!.expectKey = false;
      } else if (char === ",") {
        const top = stack[stack.length - 1];
        if (top && top.type === "object") {
          expectKey = true;
          top.expectKey = true;
        } else {
          expectKey = false;
          if (top) top.expectKey = false;
        }
      }
      tokens.push({ type: "punctuation", text: char });
      i++;
      continue;
    }

    // String
    if (char === '"') {
      let text = '"';
      i++;
      while (i < len && json.charAt(i) !== '"') {
        if (json.charAt(i) === "\\" && i + 1 < len) {
          text += json.charAt(i) + json.charAt(i + 1);
          i += 2;
        } else {
          text += json.charAt(i);
          i++;
        }
      }
      if (i < len) {
        text += '"';
        i++;
      }
      tokens.push({ type: "string", text, isKey: expectKey });
      expectKey = false;
      if (stack.length > 0) stack[stack.length - 1]!.expectKey = false;
      continue;
    }

    // Number
    if (/[-\d.]/.test(char)) {
      let text = "";
      while (i < len && /[-\d.eE+]/.test(json.charAt(i))) {
        text += json.charAt(i);
        i++;
      }
      tokens.push({ type: "number", text });
      expectKey = false;
      if (stack.length > 0) stack[stack.length - 1]!.expectKey = false;
      continue;
    }

    // Boolean / null
    const rest = json.slice(i);
    const keywords = ["true", "false", "null"] as const;
    let matched = false;
    for (const kw of keywords) {
      if (rest.startsWith(kw)) {
        tokens.push({ type: "keyword", text: kw });
        i += kw.length;
        matched = true;
        break;
      }
    }
    if (matched) {
      expectKey = false;
      if (stack.length > 0) stack[stack.length - 1]!.expectKey = false;
      continue;
    }

    // Unknown character, treat as plain
    tokens.push({ type: "plain", text: char });
    i++;
  }

  return tokens;
}

function splitEnvVars(tokens: Token[]): Token[] {
  const result: Token[] = [];
  const envRegex = /\$\{([^}]+)\}/g;

  for (const token of tokens) {
    if (token.type !== "string") {
      result.push(token);
      continue;
    }

    // Extract the raw content without quotes
    const isQuoted = token.text.startsWith('"') && token.text.endsWith('"');
    const raw = isQuoted ? token.text.slice(1, -1) : token.text;
    const parts: { text: string; isEnv: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const regex = new RegExp(envRegex.source, "g");
    while ((match = regex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: raw.slice(lastIndex, match.index), isEnv: false });
      }
      parts.push({ text: match[0], isEnv: true });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < raw.length) {
      parts.push({ text: raw.slice(lastIndex), isEnv: false });
    }

    // If no env vars found, keep original token
    if (parts.length === 1 && !parts[0]!.isEnv) {
      result.push(token);
      continue;
    }

    // Rebuild with quotes around each part
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      let text = part.text;
      if (isQuoted) {
        const needsOpen = i === 0;
        const needsClose = i === parts.length - 1;
        text = (needsOpen ? '"' : "") + text + (needsClose ? '"' : "");
      }
      result.push({
        type: part.isEnv ? "envvar" : "string",
        text,
        isKey: token.isKey && i === 0,
      });
    }
  }

  return result;
}

function tokensToChunks(tokens: Token[], theme: Theme): TextChunk[] {
  return tokens.map((token) => {
    const chunk: TextChunk = { __isChunk: true, text: token.text };
    switch (token.type) {
      case "punctuation":
        chunk.fg = RGBA.fromHex(theme.colors.muted);
        break;
      case "string":
        chunk.fg = RGBA.fromHex(token.isKey ? theme.colors.primary : theme.colors.success);
        break;
      case "number":
        chunk.fg = RGBA.fromHex(theme.colors.secondary);
        break;
      case "keyword":
        chunk.fg = RGBA.fromHex(theme.colors.accent);
        break;
      case "envvar":
        chunk.fg = RGBA.fromHex(theme.colors.cool);
        chunk.attributes = 1; // bold
        break;
      // "whitespace" and "plain" use default terminal color
    }
    return chunk;
  });
}

export function highlightJson(input: string, theme: Theme): StyledText {
  // Try to parse and pretty-print
  let jsonString: string;
  try {
    const parsed = JSON.parse(input);
    jsonString = JSON.stringify(parsed, null, 2);
  } catch {
    // If it's not valid JSON, show it as-is (plain text)
    return new StyledText([{ __isChunk: true, text: input }]);
  }

  const tokens = tokenizeJson(jsonString);
  const splitTokens = splitEnvVars(tokens);
  const chunks = tokensToChunks(splitTokens, theme);
  return new StyledText(chunks);
}
