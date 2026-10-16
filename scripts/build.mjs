// Builds the Vercel site from tracker.html (the same page published as the Claude artifact).
// Output: public/index.html with a full <head>, plus the manifest and icons from static/.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";

const src = readFileSync("tracker.html", "utf8");
const split = src.indexOf("<header");
if (split < 0) throw new Error("tracker.html: <header> not found");
const headPart = src.slice(0, split).replace(/<meta name="claude:[^>]*>\s*/g, "");
const bodyPart = src.slice(split);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#0F4F49">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Gut Log">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
${headPart.trim()}
</head>
<body>
${bodyPart.trim()}
</body>
</html>
`;

rmSync("public", { recursive: true, force: true });
mkdirSync("public", { recursive: true });
cpSync("static", "public", { recursive: true });
writeFileSync("public/index.html", html);
console.log("Built public/index.html");
