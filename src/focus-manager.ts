import type { Renderable } from "@opentui/core";

export class FocusManager {
  private zones: Renderable[] = [];
  private index = 0;

  register(renderable: Renderable) {
    this.zones.push(renderable);
  }

  focusNext() {
    if (this.zones.length === 0) return;
    this.zones[this.index]?.blur();
    this.index = (this.index + 1) % this.zones.length;
    this.zones[this.index]?.focus();
  }

  focusPrevious() {
    if (this.zones.length === 0) return;
    this.zones[this.index]?.blur();
    this.index = (this.index - 1 + this.zones.length) % this.zones.length;
    this.zones[this.index]?.focus();
  }

  focusByIndex(idx: number) {
    if (idx < 0 || idx >= this.zones.length) return;
    this.zones[this.index]?.blur();
    this.index = idx;
    this.zones[this.index]?.focus();
  }

  getCurrent() {
    return this.zones[this.index];
  }
}
