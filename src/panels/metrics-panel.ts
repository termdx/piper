import type { RenderContext, Renderable } from "@opentui/core";
import { BoxRenderable, TextRenderable, TextAttributes } from "@opentui/core";
import type { Theme, PerformanceMetrics } from "../types";

const BAR_WIDTH = 25;

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
  const b = Math.max(0, (num & 0x0000ff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export class MetricsPanel {
  panel: BoxRenderable;
  timelineRow: BoxRenderable;
  barRows: Map<string, { label: TextRenderable; fill: BoxRenderable; value: TextRenderable }> = new Map();
  totalText: TextRenderable;
  sizeText: TextRenderable;
  theme: Theme;

  private animationIntervals: Timer[] = [];
  private currentMetrics?: PerformanceMetrics;

  constructor(renderer: RenderContext, theme: Theme) {
    this.theme = theme;

    this.panel = new BoxRenderable(renderer, {
      id: "metrics-panel",
      flexDirection: "column",
      backgroundColor: darkenColor(theme.colors.background, 30),
      padding: 1,
      height: 14,
      gap: 0,
    });

    const label = new TextRenderable(renderer, {
      content: " Metrics ",
      fg: theme.colors.muted,
      attributes: TextAttributes.DIM,
      alignSelf: "flex-start",
    });
    this.panel.add(label);

    // Timeline waterfall row
    this.timelineRow = new BoxRenderable(renderer, {
      id: "timeline-row",
      flexDirection: "row",
      height: 1,
      marginY: 1,
    });
    this.panel.add(this.timelineRow);

    // Metric bars
    const metrics = [
      { key: "dnsLookup", label: "DNS", color: theme.colors.cool },
      { key: "tcpConnection", label: "TCP", color: theme.colors.success },
      { key: "tlsHandshake", label: "TLS", color: theme.colors.secondary },
      { key: "ttfb", label: "TTFB", color: theme.colors.accent },
      { key: "contentDownload", label: "Download", color: theme.colors.primary },
    ];

    for (const m of metrics) {
      const row = new BoxRenderable(renderer, {
        id: `metric-row-${m.key}`,
        flexDirection: "row",
        gap: 1,
        alignItems: "center",
        height: 1,
      });

      const label = new TextRenderable(renderer, {
        content: m.label.padEnd(10),
        fg: m.color,
        width: 10,
      });

      const track = new BoxRenderable(renderer, {
        id: `metric-track-${m.key}`,
        flexDirection: "row",
        width: BAR_WIDTH,
        height: 1,
      });

      const fill = new BoxRenderable(renderer, {
        id: `metric-fill-${m.key}`,
        width: 0,
        height: 1,
        backgroundColor: m.color,
      });
      track.add(fill);

      const value = new TextRenderable(renderer, {
        content: "0.0 ms",
        fg: theme.colors.white,
        width: 10,
      });

      row.add(label);
      row.add(track);
      row.add(value);
      this.panel.add(row);

      this.barRows.set(m.key, { label, fill, value });
    }

    // Totals row
    const totalsRow = new BoxRenderable(renderer, {
      id: "totals-row",
      flexDirection: "row",
      gap: 2,
      marginTop: 1,
    });
    this.totalText = new TextRenderable(renderer, {
      content: "Total: 0 ms",
      fg: theme.colors.accent,
      attributes: TextAttributes.BOLD,
    });
    this.sizeText = new TextRenderable(renderer, {
      content: "Size: 0 B",
      fg: theme.colors.white,
    });
    totalsRow.add(this.totalText);
    totalsRow.add(this.sizeText);
    this.panel.add(totalsRow);
  }

  setMetrics(metrics: PerformanceMetrics) {
    this.currentMetrics = metrics;
    // Clear previous animations
    this.animationIntervals.forEach(clearInterval);
    this.animationIntervals = [];

    const maxTime = Math.max(
      metrics.dnsLookup,
      metrics.tcpConnection,
      metrics.tlsHandshake,
      metrics.ttfb,
      metrics.contentDownload,
      1
    );

    // Animate bars
    for (const [key, row] of this.barRows) {
      const value = metrics[key as keyof PerformanceMetrics] as number;
      const targetWidth = Math.max(0, Math.min(BAR_WIDTH, Math.round((value / maxTime) * BAR_WIDTH)));
      let currentWidth = 0;

      const interval = setInterval(() => {
        if (currentWidth >= targetWidth) {
          clearInterval(interval);
          return;
        }
        currentWidth++;
        row.fill.width = currentWidth;
        row.value.content = `${value.toFixed(1)} ms`;
      }, 20);
      this.animationIntervals.push(interval);
    }

    // Update timeline waterfall
    for (const child of this.timelineRow.getChildren()) {
      this.timelineRow.remove(child.id);
    }
    const timelineSegments = [
      { value: metrics.dnsLookup, color: this.theme.colors.cool },
      { value: metrics.tcpConnection, color: this.theme.colors.success },
      { value: metrics.tlsHandshake, color: this.theme.colors.secondary },
      { value: metrics.ttfb, color: this.theme.colors.accent },
      { value: metrics.contentDownload, color: this.theme.colors.primary },
    ].filter((s) => s.value > 0);

    const totalSegmentTime = timelineSegments.reduce((sum, s) => sum + s.value, 0);
    const r = this.timelineRow.ctx;
    for (const seg of timelineSegments) {
      const segWidth = Math.max(1, Math.round((seg.value / totalSegmentTime) * BAR_WIDTH));
      const block = new TextRenderable(r, {
        content: "█".repeat(segWidth),
        fg: seg.color,
      });
      this.timelineRow.add(block);
    }

    this.totalText.content = `Total: ${metrics.total.toFixed(0)} ms`;
    this.sizeText.content = `Size: ${formatBytes(metrics.contentLength)}`;
  }

  clear() {
    this.currentMetrics = undefined;
    this.animationIntervals.forEach(clearInterval);
    this.animationIntervals = [];
    for (const [, row] of this.barRows) {
      row.fill.width = 0;
      row.value.content = "0.0 ms";
    }
    for (const child of this.timelineRow.getChildren()) {
      this.timelineRow.remove(child.id);
    }
    this.totalText.content = "Total: 0 ms";
    this.sizeText.content = "Size: 0 B";
  }

  applyTheme(theme: Theme) {
    this.theme = theme;
    this.panel.backgroundColor = darkenColor(theme.colors.background, 30);

    const metricColors: Record<string, string> = {
      dnsLookup: theme.colors.cool,
      tcpConnection: theme.colors.success,
      tlsHandshake: theme.colors.secondary,
      ttfb: theme.colors.accent,
      contentDownload: theme.colors.primary,
    };

    for (const [key, row] of this.barRows) {
      const color = metricColors[key] ?? theme.colors.white;
      row.label.fg = color;
      row.fill.backgroundColor = color;
    }

    this.totalText.fg = theme.colors.accent;
    this.sizeText.fg = theme.colors.white;

    if (this.currentMetrics) {
      for (const child of this.timelineRow.getChildren()) {
        this.timelineRow.remove(child.id);
      }
      const timelineSegments = [
        { value: this.currentMetrics.dnsLookup, color: theme.colors.cool },
        { value: this.currentMetrics.tcpConnection, color: theme.colors.success },
        { value: this.currentMetrics.tlsHandshake, color: theme.colors.secondary },
        { value: this.currentMetrics.ttfb, color: theme.colors.accent },
        { value: this.currentMetrics.contentDownload, color: theme.colors.primary },
      ].filter((s) => s.value > 0);

      const totalSegmentTime = timelineSegments.reduce((sum, s) => sum + s.value, 0);
      const r = this.timelineRow.ctx;
      for (const seg of timelineSegments) {
        const segWidth = Math.max(1, Math.round((seg.value / totalSegmentTime) * BAR_WIDTH));
        const block = new TextRenderable(r, {
          content: "█".repeat(segWidth),
          fg: seg.color,
        });
        this.timelineRow.add(block);
      }
    }
  }

  getFocusables(): Renderable[] {
    return [];
  }
}
