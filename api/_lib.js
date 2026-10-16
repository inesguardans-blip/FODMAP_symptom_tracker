// Shared helpers for the API routes. Files starting with "_" are not deployed as routes.
import crypto from "node:crypto";

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function configured() {
  return Boolean(redisUrl() && redisToken() && process.env.APP_PASSWORD);
}

// Upstash Redis REST API: one command, or several in one round trip.
export async function redis(command) {
  const r = await fetch(redisUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `redis ${r.status}`);
  return j.result;
}
export async function pipeline(commands) {
  const r = await fetch(redisUrl().replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  const j = await r.json();
  if (!r.ok || !Array.isArray(j)) throw new Error(`redis ${r.status}`);
  return j.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

// Session cookie: "v1.<expiry>.<hmac>", signed with SESSION_SECRET (or the password itself,
// so changing APP_PASSWORD signs every device out).
const COOKIE = "gl_session";
const secret = () => process.env.SESSION_SECRET || process.env.APP_PASSWORD || "";
const sign = v => crypto.createHmac("sha256", secret()).update(v).digest("base64url");

export function makeToken(days = 180) {
  const v = `v1.${Date.now() + days * 86400000}`;
  return `${v}.${sign(v)}`;
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach(part => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
export function authed(req) {
  const c = cookies(req)[COOKIE];
  if (!c || !secret()) return false;
  const i = c.lastIndexOf(".");
  const v = c.slice(0, i), s = c.slice(i + 1), good = sign(v);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return false;
  return Number(v.split(".")[1]) > Date.now();
}
export function setSession(res, token, maxAgeSeconds) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`);
}
export function passwordMatches(given) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(String(process.env.APP_PASSWORD || "")).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  let data = "";
  for await (const chunk of req) data += chunk;
  return data ? JSON.parse(data) : {};
}
export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
