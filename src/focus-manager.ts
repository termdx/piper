import type { Renderable, RenderContext } from "@opentui/core";

export class FocusManager {
  private zones: Renderable[] = [];
  private index = 0;
  private changeListeners: ((renderable: Renderable | null) => void)[] = [];

  register(renderable: Renderable) {
    this.zones.push(renderable);
  }

  onChange(listener: (renderable: Renderable | null) => void) {
    this.changeListeners.push(listener);
  }

  private notify() {
    const current = this.zones[this.index] ?? null;
    for (const l of this.changeListeners) {
      l(current);
    }
  }

  focusNext() {
    if (this.zones.length === 0) return;
    this.zones[this.index]?.blur();
    this.index = (this.index + 1) % this.zones.length;
    this.zones[this.index]?.focus();
    this.notify();
  }

  focusPrevious() {
    if (this.zones.length === 0) return;
    this.zones[this.index]?.blur();
    this.index = (this.index - 1 + this.zones.length) % this.zones.length;
    this.zones[this.index]?.focus();
    this.notify();
  }

  focusByIndex(idx: number) {
    if (idx < 0 || idx >= this.zones.length) return;
    this.zones[this.index]?.blur();
    this.index = idx;
    this.zones[this.index]?.focus();
    this.notify();
  }

  getCurrentIndex() {
    return this.index;
  }

  getCurrent() {
    return this.zones[this.index];
  }
}
