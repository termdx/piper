import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import type { RequestConfig, ApiResponse, PerformanceMetrics, DownloadProgress } from "../types";

export function sendRequest(
  config: RequestConfig & { onProgress?: (p: DownloadProgress) => void }
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(config.url);
    const client = url.protocol === "https:" ? https : http;

    const start = performance.now();
    let dnsTime = 0;
    let tcpTime = 0;
    let tlsTime = 0;
    let ttfbTime = 0;
    let firstByte = false;

    const headers: Record<string, string> =
      typeof config.headers === "string"
        ? (JSON.parse(config.headers || "{}") as Record<string, string>)
        : config.headers || {};

    const body = config.body
      ? typeof config.body === "string"
        ? config.body
        : JSON.stringify(config.body)
      : undefined;

    if (body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const reqStart = performance.now();

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: config.method,
        headers,
      },
      (res) => {
        const ttfb = performance.now() - reqStart;
        ttfbTime = ttfb;

        const chunks: Buffer[] = [];
        let received = 0;
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let lastProgressTime = performance.now();
        let lastReceived = 0;

        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          received += chunk.length;

          const now = performance.now();
          const dt = (now - lastProgressTime) / 1000;
          if (dt > 0.2) {
            const speed = dt > 0 ? (received - lastReceived) / dt : 0;
            config.onProgress?.({
              bytesReceived: received,
              totalBytes: total,
              speed,
            });
            lastProgressTime = now;
            lastReceived = received;
          }
        });

        res.on("end", () => {
          const end = performance.now();
          const bodyStr = Buffer.concat(chunks).toString("utf-8");

          const metrics: PerformanceMetrics = {
            dnsLookup: dnsTime,
            tcpConnection: tcpTime,
            tlsHandshake: tlsTime,
            ttfb: ttfbTime,
            contentDownload: end - reqStart - ttfbTime,
            total: end - start,
            contentLength: received,
          };

          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || "",
            headers: res.headers as Record<string, string>,
            body: bodyStr,
            metrics,
          });
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
