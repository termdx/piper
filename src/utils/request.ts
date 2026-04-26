import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import { URL } from "node:url";
import type { RequestConfig, ApiResponse, PerformanceMetrics } from "../types";
import { interpolateEnv } from "./env";

interface TimingState {
  dnsLookup: number;
  tcpConnection: number;
  tlsHandshake: number;
  startTime: number;
  reqStartTime: number;
}

function createTimedAgent(
  protocol: "http:" | "https:",
  timings: TimingState
): http.Agent | https.Agent {
  if (protocol === "https:") {
    return new https.Agent({
      createConnection: (options: any, callback: any) => {
        const socket = tls.connect(options as tls.ConnectionOptions, () => {
          timings.tlsHandshake = performance.now() - timings.reqStartTime - timings.tcpConnection;
        });

        socket.on("connect", () => {
          timings.tcpConnection = performance.now() - timings.reqStartTime;
        });

        if (callback) {
          socket.on("ready", () => callback(null as any, socket));
          socket.on("error", (err: any) => callback(err, socket));
        }

        return socket;
      },
    } as any);
  }

  return new http.Agent({
    createConnection: (options: any, callback: any) => {
      const socket = net.createConnection(options as net.NetConnectOpts, () => {
        timings.tcpConnection = performance.now() - timings.reqStartTime;
      });

      if (callback) {
        socket.on("ready", () => callback(null as any, socket));
        socket.on("error", (err: any) => callback(err, socket));
      }

      return socket;
    },
  } as any);
}

export function sendRequest(
  config: RequestConfig
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    // Interpolate env vars
    const resolvedUrl = interpolateEnv(config.url);
    const resolvedHeaders =
      typeof config.headers === "string"
        ? interpolateEnv(config.headers)
        : config.headers;
    const resolvedBody = config.body
      ? typeof config.body === "string"
        ? interpolateEnv(config.body)
        : config.body
      : undefined;

    const url = new URL(resolvedUrl);
    const isHttps = url.protocol === "https:";

    const timings: TimingState = {
      dnsLookup: 0,
      tcpConnection: 0,
      tlsHandshake: 0,
      startTime: performance.now(),
      reqStartTime: 0,
    };

    const headers: Record<string, string> =
      typeof resolvedHeaders === "string"
        ? (JSON.parse(resolvedHeaders || "{}") as Record<string, string>)
        : resolvedHeaders || {};

    const body = resolvedBody
      ? typeof resolvedBody === "string"
        ? resolvedBody
        : JSON.stringify(resolvedBody)
      : undefined;

    if (body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    // Measure DNS lookup time manually
    const dnsStart = performance.now();
    dns.lookup(url.hostname, (err) => {
      if (err) {
        reject(err);
        return;
      }
      timings.dnsLookup = performance.now() - dnsStart;
      timings.reqStartTime = performance.now();

      const agent = createTimedAgent(url.protocol as "http:" | "https:", timings);

      const req = (isHttps ? https : http).request(
        {
          hostname: url.hostname,
          port: url.port || undefined,
          path: url.pathname + url.search,
          method: config.method,
          headers,
          agent,
        },
        (res) => {
          const ttfb = performance.now() - timings.reqStartTime;

          const chunks: Buffer[] = [];
          let received = 0;

          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
            received += chunk.length;
          });

          res.on("end", () => {
            const end = performance.now();
            const bodyStr = Buffer.concat(chunks).toString("utf-8");

            agent.destroy();

            const metrics: PerformanceMetrics = {
              dnsLookup: timings.dnsLookup,
              tcpConnection: timings.tcpConnection,
              tlsHandshake: timings.tlsHandshake,
              ttfb,
              contentDownload: end - timings.reqStartTime - ttfb,
              total: end - timings.startTime,
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
        agent.destroy();
        reject(err);
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  });
}
