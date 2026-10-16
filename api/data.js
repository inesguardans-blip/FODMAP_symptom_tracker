import { configured, authed, redis, pipeline, readBody, send } from "./_lib.js";

const DAYS = "gutlog:days";         // hash: YYYY-MM-DD -> day JSON
const SETTINGS = "gutlog:settings"; // string: settings JSON
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DOC = 200_000;

export default async function handler(req, res) {
  if (!configured()) return send(res, 500, { error: "not_configured" });
  if (!authed(req)) return send(res, 401, { error: "login_required" });
  try {
    if (req.method === "GET") {
      const [flat, settings] = await pipeline([["HGETALL", DAYS], ["GET", SETTINGS]]);
      const days = {};
      for (let i = 0; i < (flat || []).length; i += 2) days[flat[i]] = JSON.parse(flat[i + 1]);
      return send(res, 200, { days, settings: settings ? JSON.parse(settings) : null });
    }
    if (req.method === "PUT") {
      let b;
      try { b = await readBody(req); } catch { return send(res, 400, { error: "bad_json" }); }
      if (b.type === "day") {
        if (!b.day || !DATE.test(b.day.date)) return send(res, 400, { error: "bad_day" });
        const json = JSON.stringify(b.day);
        if (json.length > MAX_DOC) return send(res, 413, { error: "too_large" });
        await redis(["HSET", DAYS, b.day.date, json]);
        return send(res, 200, { ok: true });
      }
      if (b.type === "settings") {
        const json = JSON.stringify(b.settings || {});
        if (json.length > MAX_DOC) return send(res, 413, { error: "too_large" });
        await redis(["SET", SETTINGS, json]);
        return send(res, 200, { ok: true });
      }
      if (b.type === "import") {
        const args = [];
        for (const [k, v] of Object.entries(b.days || {})) if (DATE.test(k) && v) args.push(k, JSON.stringify({ ...v, date: k }));
        const commands = [];
        if (args.length) commands.push(["HSET", DAYS, ...args]);
        if (b.settings) commands.push(["SET", SETTINGS, JSON.stringify(b.settings)]);
        if (commands.length) await pipeline(commands);
        return send(res, 200, { ok: true, imported: args.length / 2 });
      }
      return send(res, 400, { error: "unknown_type" });
    }
    res.setHeader("Allow", "GET, PUT");
    return send(res, 405, { error: "method_not_allowed" });
  } catch (e) {
    console.error(e);
    return send(res, 502, { error: "storage_unavailable" });
  }
}
