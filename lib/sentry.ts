/**
 * Sentry 集成桩。生产部署前执行：
 *   npm install @sentry/nextjs
 *   npx @sentry/wizard@latest -i nextjs
 * 然后把下面的桩函数替换为对 Sentry SDK 的真实调用。
 *
 * 在桩状态下，captureException 仅写入结构化日志，足以让 lib/logger.ts 的 req.error
 * 行携带错误信息；接入 Sentry 后可关联到 issue。
 */
import { log } from "./logger";

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (process.env.SENTRY_DSN) {
    // PLACEHOLDER: import * as Sentry from "@sentry/nextjs"; Sentry.captureException(err, { extra: context });
  }
  log.error("captured_exception", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    ...context,
  });
}

export function captureMessage(msg: string, context?: Record<string, unknown>) {
  if (process.env.SENTRY_DSN) {
    // PLACEHOLDER: Sentry.captureMessage(msg, { extra: context });
  }
  log.warn("captured_message", { msg, ...context });
}
