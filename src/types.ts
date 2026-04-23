export interface Theme {
  name: string;
  colors: {
    background: string;
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    error: string;
    muted: string;
    white: string;
    cool: string;
  };
}

export interface RequestConfig {
  method: string;
  url: string;
  headers?: Record<string, string> | string;
  body?: string | Record<string, unknown>;
}

export interface HistoryEntry extends RequestConfig {
  timestamp: number;
  responseStatus?: number;
  responseTime?: number;
}

export interface PerformanceMetrics {
  dnsLookup: number;
  tcpConnection: number;
  tlsHandshake: number;
  ttfb: number;
  contentDownload: number;
  total: number;
  contentLength: number;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  metrics: PerformanceMetrics;
}

export interface DownloadProgress {
  bytesReceived: number;
  totalBytes: number;
  speed: number;
}
