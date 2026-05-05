import { randomUUID } from "crypto";

type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, msg: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};

/**
 * 包装 API 路由，自动记录耗时、状态码、请求 ID。
 * 用法：
 *   export const POST = withLogging("ingest.telemetry", async (req, ctx) => { ... })
 */
export function withLogging<Ctx>(
  route: string,
  handler: (req: Request, ctx: Ctx, reqId: string) => Promise<Response>
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const reqId = req.headers.get("x-request-id") ?? randomUUID();
    const started = Date.now();
    const url = new URL(req.url);
    log.info("req.start", { reqId, route, method: req.method, path: url.pathname });
    try {
      const res = await handler(req, ctx, reqId);
      const ms = Date.now() - started;
      log.info("req.end", {
        reqId,
        route,
        method: req.method,
        path: url.pathname,
        status: res.status,
        ms,
      });
      // 把请求 ID 也回写到响应头，方便客户端关联问题
      try {
        res.headers.set("x-request-id", reqId);
      } catch {
        /* immutable response */
      }
      return res;
    } catch (err) {
      const ms = Date.now() - started;
      log.error("req.error", {
        reqId,
        route,
        method: req.method,
        path: url.pathname,
        ms,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  };
}
