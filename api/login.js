import { configured, passwordMatches, makeToken, setSession, readBody, send } from "./_lib.js";

const SIX_MONTHS = 180 * 86400;

export default async function handler(req, res) {
  if (req.method === "POST") {
    if (!configured()) return send(res, 500, { error: "not_configured" });
    let body = {};
    try { body = await readBody(req); } catch { return send(res, 400, { error: "bad_json" }); }
    await new Promise(r => setTimeout(r, 400)); // slows down password guessing
    if (!passwordMatches(body.password)) return send(res, 401, { error: "wrong_password" });
    setSession(res, makeToken(180), SIX_MONTHS);
    return send(res, 200, { ok: true });
  }
  if (req.method === "DELETE") {
    setSession(res, "", 0);
    return send(res, 200, { ok: true });
  }
  res.setHeader("Allow", "POST, DELETE");
  return send(res, 405, { error: "method_not_allowed" });
}
