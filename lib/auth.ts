import { createHmac, timingSafeEqual } from "crypto";

const MAX_SKEW_MS = 5 * 60 * 1000;

export type AuthResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * 验证 HMAC-SHA256 签名。
 * 客户端必须发送：
 *   X-Timestamp: 当前 unix 毫秒
 *   X-Signature: hex(hmac_sha256(secret, `${timestamp}.${rawBody}`))
 *
 * 行为：
 *   - 生产环境：secret 必须设置且签名必须正确
 *   - 开发环境且 secret 未设置：跳过校验（方便 curl 调试）
 *   - 时间戳偏差 > 5 分钟视为重放，拒绝
 */
export function verifyHmac(
  secretEnvKey: string,
  rawBody: string,
  headers: Headers
): AuthResult {
  const secret = process.env[secretEnvKey];
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      return { ok: false, status: 500, error: `${secretEnvKey} is not configured` };
    }
    return { ok: true };
  }

  const ts = headers.get("x-timestamp");
  const sig = headers.get("x-signature");
  if (!ts || !sig) {
    return { ok: false, status: 401, error: "missing X-Timestamp or X-Signature" };
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > MAX_SKEW_MS) {
    return { ok: false, status: 401, error: "timestamp out of range" };
  }

  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "hex");
  } catch {
    return { ok: false, status: 401, error: "invalid signature format" };
  }

  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, status: 401, error: "signature mismatch" };
  }

  return { ok: true };
}
