# Piper

A fast, keyboard-driven API client for the terminal. Built with [OpenTUI](https://github.com/termdx/opentui).

Piper is protocol-agnostic by design — start with HTTP, then chain requests, stream WebSockets, and script workflows without leaving your terminal.

## Features

- **Interactive TUI** — No mouse required. Tab through panels, edit headers and body in popups, navigate history with search.
- **Syntax Highlighted JSON** — Request and response bodies are pretty-printed and color-coded.
- **History with Ghost Suggestions** — URLs autocomplete from your past requests as you type.
- **One-Key Exports** — Copy the current request as `cURL` or copy response text to clipboard with `Ctrl+Y`.
- **Themes** — Built-in Tokyo Night, Catppuccin, Nord, Gruvbox, and more.

## Coming Soon

- **Request Chaining** — Pipe the output of one request into the next. Build API workflows like Unix pipes.
- **WebSocket Support** — Connect, send, and stream messages in real time.
- **Collections & Environments** — Save and organize requests into collections with variable substitution.

## Install

Piper requires [Bun](https://bun.sh) to run.

```bash
bun install -g @termdx/piper
```

## Usage

```bash
piper
```

Launch Piper and start making requests immediately.

## Keybindings

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Cycle focus between panels |
| `Ctrl+Enter` | Send request |
| `Ctrl+M` | Open method selector |
| `Ctrl+B` | Open body editor |
| `Ctrl+H` | Open header editor |
| `Ctrl+T` | Switch theme |
| `Ctrl+E` | Export current request as cURL |
| `Ctrl+Y` | Yank (copy) selected text to clipboard |
| `Ctrl+/` | Show keymap popup |
| `Ctrl+Q` | Quit |

## Development

```bash
bun install
bun dev
```

## Build

```bash
bun run build
```

## License

MIT
