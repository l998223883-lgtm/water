// Edge-runtime compatible session signing using Web Crypto API.
// 同时在 Node (API 路由) 和 Edge (middleware) 下工作。

const COOKIE_NAME = "ww_session";
const MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7天

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is not configured (min 16 chars)");
  }
  return s;
}

const enc = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, "0");
  }
  return s;
}

function hexToBuf(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const b = parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(b)) return null;
    out[i] = b;
  }
  return out;
}

async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bufToHex(sig);
}

export async function createSessionToken(): Promise<string> {
  const ts = Date.now().toString();
  const sig = await sign(ts);
  return `${ts}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const idx = token.indexOf(".");
  if (idx < 0) return false;
  const ts = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Date.now() - tsNum > MAX_AGE_SEC * 1000) return false;

  const provided = hexToBuf(sig);
  if (!provided) return false;
  try {
    const key = await getKey();
    return await crypto.subtle.verify("HMAC", key, provided, enc.encode(ts));
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SEC = MAX_AGE_SEC;
