// Test helpers: serve the app folder, open it in Chromium in "this device only" mode
// (Firebase is stubbed out so tests never touch the real database).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };

export async function startServer() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "") || "index.html";
    if (path.startsWith("..")) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch { res.writeHead(404); res.end("not found"); }
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(r => server.close(r)) };
}

export async function launch() {
  const opts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] } : {};
  return chromium.launch(opts);
}

// A fresh page with empty storage. `seed` = sessions to put in localStorage before the app starts.
export async function openApp(browser, url, { seed = null, viewport = { width: 420, height: 900 }, today = "2026-11-01" } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block", acceptDownloads: true });
  // No Firebase in tests: an unconfigured app stores to this device only.
  await ctx.route("**/firebase-config.js", r => r.fulfill({ contentType: "text/javascript", body: 'export const firebaseConfig = { apiKey: "YOUR_API_KEY" };' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com/, r => r.abort());
  // Freeze "today" so date logic is repeatable.
  await ctx.addInitScript(({ today, seed }) => {
    const fixed = new Date(today + "T12:00:00").getTime();
    const RealDate = Date;
    class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }
    window.Date = FakeDate;
    if (seed && !sessionStorage.getItem("seeded")) { localStorage.setItem("wlog.sessions", JSON.stringify(seed)); sessionStorage.setItem("seeded", "1"); }
  }, { today, seed });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(url);
  await page.waitForSelector("#f-bench-0-w, #list .ex");
  return { page, ctx, errors };
}

export const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("wlog.sessions") || "{}"));
export const waitSaved = page => page.waitForFunction(() => document.getElementById("status").textContent.includes("已儲存"), null, { timeout: 5000 });

export async function fill(page, sel, value) {
  await page.fill(sel, value);
}

export function session(date, day, sets, extra = {}) {
  return { day, date, sets, units: {}, updated: date + "T10:00:00.000Z", ...extra };
}
