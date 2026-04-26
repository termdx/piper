import type { RenderContext, Renderable } from "@opentui/core";
import { BoxRenderable, TextRenderable, TextAttributes } from "@opentui/core";
import type { Theme, PerformanceMetrics } from "../types";
import { darkenColor } from "../utils/colors";

const GAUGE_WIDTH = 20;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function renderGauge(percent: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export class MetricsPanel {
  panel: BoxRenderable;
  gaugeTexts: Map<string, TextRenderable> = new Map();
  valueTexts: Map<string, TextRenderable> = new Map();
  totalText: TextRenderable;
  sizeText: TextRenderable;
  theme: Theme;

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

    // Metric gauge rows
    const metrics = [
      { key: "dnsLookup", label: "DNS", color: theme.colors.cool },
      { key: "tcpConnection", label: "TCP", color: theme.colors.success },
      { key: "tlsHandshake", label: "TLS", color: theme.colors.secondary },
      { key: "ttfb", label: "TTFB", color: theme.colors.accent },
      { key: "contentDownload", label: "DL", color: theme.colors.primary },
    ];

    for (const m of metrics) {
      const row = new BoxRenderable(renderer, {
        id: `metric-row-${m.key}`,
        flexDirection: "row",
        gap: 1,
        alignItems: "center",
        height: 1,
        marginY: 0,
      });

      const labelText = new TextRenderable(renderer, {
        content: m.label.padEnd(4),
        fg: m.color,
        width: 4,
      });

      const gaugeText = new TextRenderable(renderer, {
        content: "░".repeat(GAUGE_WIDTH),
        fg: m.color,
      });

      const valueText = new TextRenderable(renderer, {
        content: "--ms",
        fg: theme.colors.white,
        width: 8,
      });

      row.add(labelText);
      row.add(gaugeText);
      row.add(valueText);
      this.panel.add(row);

      this.gaugeTexts.set(m.key, gaugeText);
      this.valueTexts.set(m.key, valueText);
    }

    // Totals row
    const totalsRow = new BoxRenderable(renderer, {
      id: "totals-row",
      flexDirection: "row",
      gap: 2,
      marginTop: 1,
    });
    this.totalText = new TextRenderable(renderer, {
      content: "Total: --ms",
      fg: theme.colors.accent,
      attributes: TextAttributes.BOLD,
    });
    this.sizeText = new TextRenderable(renderer, {
      content: "Size: --",
      fg: theme.colors.white,
    });
    totalsRow.add(this.totalText);
    totalsRow.add(this.sizeText);
    this.panel.add(totalsRow);
  }

  setMetrics(metrics: PerformanceMetrics) {
    this.currentMetrics = metrics;

    const total =
      metrics.dnsLookup +
      metrics.tcpConnection +
      metrics.tlsHandshake +
      metrics.ttfb +
      metrics.contentDownload ||
      1;

    const entries = [
      { key: "dnsLookup", value: metrics.dnsLookup },
      { key: "tcpConnection", value: metrics.tcpConnection },
      { key: "tlsHandshake", value: metrics.tlsHandshake },
      { key: "ttfb", value: metrics.ttfb },
      { key: "contentDownload", value: metrics.contentDownload },
    ];

    for (const e of entries) {
      const gauge = this.gaugeTexts.get(e.key);
      const valueText = this.valueTexts.get(e.key);
      if (!gauge || !valueText) continue;

      const percent = (e.value / total) * 100;
      gauge.content = renderGauge(percent, GAUGE_WIDTH);
      valueText.content = `${e.value.toFixed(0)}ms`;
    }

    this.totalText.content = `Total: ${metrics.total.toFixed(0)}ms`;
    this.sizeText.content = `Size: ${formatBytes(metrics.contentLength)}`;
  }

  clear() {
    this.currentMetrics = undefined;
    for (const gauge of this.gaugeTexts.values()) {
      gauge.content = "░".repeat(GAUGE_WIDTH);
    }
    for (const valueText of this.valueTexts.values()) {
      valueText.content = "--ms";
    }
    this.totalText.content = "Total: --ms";
    this.sizeText.content = "Size: --";
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

    for (const [key, gauge] of this.gaugeTexts) {
      const color = metricColors[key] ?? theme.colors.white;
      gauge.fg = color;
    }

    this.totalText.fg = theme.colors.accent;
    this.sizeText.fg = theme.colors.white;

    if (this.currentMetrics) {
      this.setMetrics(this.currentMetrics);
    }
  }

  getFocusables(): Renderable[] {
    return [];
  }
}
