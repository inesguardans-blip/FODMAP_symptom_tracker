// Shared helpers for the API routes. Files starting with "_" are not deployed as routes.
import crypto from "node:crypto";

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// People who can sign in. APP_PASSWORD is the original user ("main"), whose data keeps its
// original keys. APP_USERS adds more people as "name:password", separated by ";" or new lines.
export function users() {
  const list = [];
  if (process.env.APP_PASSWORD) list.push({ id: "main", password: process.env.APP_PASSWORD });
  (process.env.APP_USERS || "").split(/[;\n]/).forEach(entry => {
    const i = entry.indexOf(":");
    if (i < 1) return;
    const id = entry.slice(0, i).trim().toLowerCase();
    const password = entry.slice(i + 1).trim();
    if (/^[a-z0-9_-]{1,32}$/.test(id) && id !== "main" && password && !list.some(u => u.id === id)) list.push({ id, password });
  });
  return list;
}
export function keysFor(user) {
  return user === "main"
    ? { days: "gutlog:days", settings: "gutlog:settings" }
    : { days: `gutlog:u:${user}:days`, settings: `gutlog:u:${user}:settings` };
}

export function configured() {
  return Boolean(redisUrl() && redisToken() && users().length);
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

// Session cookie: "v2.<user>.<expiry>.<hmac>" (older "v1.<expiry>.<hmac>" cookies mean the main user),
// signed with SESSION_SECRET, or APP_PASSWORD when that is unset.
const COOKIE = "gl_session";
const secret = () => process.env.SESSION_SECRET || process.env.APP_PASSWORD || "";
const sign = v => crypto.createHmac("sha256", secret()).update(v).digest("base64url");

export function makeToken(user, days = 180) {
  const v = `v2.${user}.${Date.now() + days * 86400000}`;
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
// Returns the signed-in user's id, or null.
export function authed(req) {
  const c = cookies(req)[COOKIE];
  if (!c || !secret()) return null;
  const i = c.lastIndexOf(".");
  const v = c.slice(0, i), s = c.slice(i + 1), good = sign(v);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  const parts = v.split(".");
  const [user, exp] = parts[0] === "v1" ? ["main", parts[1]] : parts[0] === "v2" ? [parts[1], parts[2]] : [null, 0];
  if (!user || !(Number(exp) > Date.now())) return null;
  return users().some(u => u.id === user) ? user : null; // removing someone from APP_USERS signs them out
}
export function setSession(res, token, maxAgeSeconds) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`);
}
const digest = v => crypto.createHash("sha256").update(String(v || "")).digest();
// Which user this password belongs to, or null. Every password is compared, so timing reveals nothing.
export function userForPassword(given) {
  const a = digest(given);
  let found = null;
  for (const u of users()) if (crypto.timingSafeEqual(a, digest(u.password)) && !found) found = u.id;
  return found;
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
