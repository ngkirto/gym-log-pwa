// Stress tests: lots of records, fast typing, fast tab switching. Run:  npm test
// Timings are printed so you can compare runs; limits are generous so slow laptops still pass.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, launch, openApp, stored, waitSaved } from "./helpers.mjs";

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

const DAYS = ["A1", "B1", "A2", "B2"];
const EX = { A1: ["bench", "latpd", "incdb", "lowrow", "cablex", "straightpd", "curl", "rope"], B1: ["squat", "legext", "legcurl", "shpress", "latraise", "facepull", "curl", "rope"], A2: ["incbb", "closepd", "dbpress", "divrow", "fly", "curl", "rope"], B2: ["legpress", "hipthrust", "legcurl", "dbsh", "reardelt", "cablelat", "singlecurl", "tripress"] };

// n sessions, 4 a week going back from 2026-10-31: a realistic multi-year history
function history(n) {
  const out = {}; const d = new Date("2026-10-31T12:00:00Z");
  for (let i = 0; i < n; i++) {
    const day = DAYS[i % 4];
    d.setUTCDate(d.getUTCDate() - (i % 4 === 3 ? 4 : 1));
    const date = d.toISOString().slice(0, 10);
    const sets = {};
    for (const k of EX[day]) sets[k] = Array.from({ length: 4 }, (_, s) => ({ w: String(20 + (n - i) * 0.1 + s), r: String(8 + (s % 3)) }));
    out[`${date}_${day}`] = { day, date, sets, units: {}, updated: `${date}T10:00:00.000Z` };
  }
  return out;
}
const ms = t => `${Math.round(performance.now() - t)} ms`;

test("opens fast with 1,000 saved sessions (about 5 years)", async () => {
  const seed = history(1000);
  const bytes = JSON.stringify(seed).length;
  const t = performance.now();
  const { page, ctx, errors } = await openApp(browser, server.url, { seed });
  const load = performance.now() - t;
  console.log(`   1,000 sessions: ${(bytes / 1024).toFixed(0)} KB stored, page ready in ${Math.round(load)} ms`);
  assert.ok(bytes < 4.5 * 1024 * 1024, "fits in the browser's ~5 MB local storage");
  assert.ok(load < 8000, "page ready within 8 s");
  assert.equal(await page.locator("#hist .h").count(), 30, "history list is capped at 30 rows");
  assert.ok(await page.getAttribute("#f-bench-0-w", "placeholder"), "上次 hint still found");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("tab switches stay quick with 1,000 sessions", async () => {
  const { page, ctx } = await openApp(browser, server.url, { seed: history(1000) });
  const t = performance.now();
  for (let i = 0; i < 40; i++) await page.click(`.tab[data-d="${DAYS[(i + 1) % 4]}"]`);
  const per = (performance.now() - t) / 40;
  console.log(`   40 tab switches: ${per.toFixed(0)} ms each`);
  assert.ok(per < 400, `each switch under 400 ms (was ${per.toFixed(0)})`);
  await ctx.close();
});

test("typing quickly into every set of a full B1 workout loses nothing", async () => {
  const { page, ctx, errors } = await openApp(browser, server.url);
  await page.click('.tab[data-d="B1"]');
  const inputs = page.locator("#list input");
  const n = await inputs.count();
  const t = performance.now();
  for (let i = 0; i < n; i++) await inputs.nth(i).pressSequentially(String(10 + i), { delay: 0 });
  console.log(`   typed into ${n} boxes in ${ms(t)}`);
  await waitSaved(page);
  const rec = (await stored(page))["2026-11-01_B1"];
  const expected = await page.$$eval("#list input", els => els.map(e => [e.id, e.value]));
  for (const [id, v] of expected) {
    const [, k, s, f] = id.split("-");
    assert.equal(rec.sets[k][+s][f], v, `${id} saved`);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("saving is batched: 300 keystrokes cause only a handful of writes", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.evaluate(() => {
    window.__writes = 0;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === "wlog.sessions") window.__writes++; return orig.call(this, k, v); };
  });
  const box = page.locator("#f-bench-0-w");
  for (let i = 0; i < 100; i++) { await box.fill(""); await box.pressSequentially(String(40 + (i % 60)), { delay: 0 }); }
  await waitSaved(page);
  const writes = await page.evaluate(() => window.__writes);
  console.log(`   ~300 keystrokes -> ${writes} write(s)`);
  assert.ok(writes <= 5, `expected a few writes, got ${writes}`);
  assert.equal((await stored(page))["2026-11-01_A1"].sets.bench[0].w, await box.inputValue());
  await ctx.close();
});

test("fast tab hopping while typing keeps every day's numbers on the right day", async () => {
  const { page, ctx, errors } = await openApp(browser, server.url);
  const first = { A1: "bench", B1: "squat", A2: "incbb", B2: "legpress" };
  for (let round = 0; round < 25; round++) {
    for (const d of DAYS) {
      await page.click(`.tab[data-d="${d}"]`);
      await page.fill(`#f-${first[d]}-0-w`, String(round));
    }
  }
  await page.click('.tab[data-d="A1"]');
  await page.waitForTimeout(1500);
  const db = await stored(page);
  for (const d of DAYS) {
    assert.equal(db[`2026-11-01_${d}`].sets[first[d]][0].w, "24", `${d} kept its last value`);
    const others = Object.keys(db[`2026-11-01_${d}`].sets).filter(k => Object.values(first).includes(k) && k !== first[d]);
    assert.deepEqual(others, [], `${d} has no numbers from other days`);
  }
  assert.equal(Object.keys(db).length, 4, "exactly one record per day, no duplicates");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("importing a 2,000-session backup works and stays responsive", async () => {
  const { page, ctx, errors } = await openApp(browser, server.url);
  const rows = Object.entries(history(2000)).map(([id, v]) => ({ id, ...v }));
  const buf = Buffer.from(JSON.stringify(rows));
  const t = performance.now();
  await page.setInputFiles("#importFile", { name: "big.json", mimeType: "application/json", buffer: buf });
  await page.waitForFunction(() => /已匯入|失敗|滿/.test(document.getElementById("status").textContent + document.getElementById("note").textContent), null, { timeout: 30000 });
  const status = await page.textContent("#status"), note = await page.textContent("#note");
  console.log(`   2,000 sessions (${(buf.length / 1024 / 1024).toFixed(1)} MB) -> "${status || note}" in ${ms(t)}`);
  assert.match(status, /已匯入 2000 次記錄/);
  const t2 = performance.now();
  await page.click('.tab[data-d="B2"]');
  console.log(`   tab switch after import: ${ms(t2)}`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a full browser storage shows a message instead of losing the typing", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  // fill the rest of local storage
  await page.evaluate(() => {
    // big chunks first, then smaller ones, until not even 16 characters fit
    let i = 0;
    for (let size = 512 * 1024; size >= 16; size = Math.floor(size / 2)) {
      const chunk = "x".repeat(size);
      while (true) { try { localStorage.setItem("fill" + i++, chunk); } catch { break; } }
    }
  });
  await page.fill("#f-bench-0-w", "99");
  await page.waitForTimeout(1800);
  const status = await page.textContent("#status");
  console.log(`   storage full -> status "${status}"`);
  assert.equal(await page.inputValue("#f-bench-0-w"), "99", "typed value still on screen");
  assert.doesNotMatch(status, /已儲存/, "does not claim it saved");
  await ctx.close();
});
