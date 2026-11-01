// Functional tests. Run:  npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { startServer, launch, openApp, stored, waitSaved, session } from "./helpers.mjs";

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

const S4 = (w, r) => Array.from({ length: 4 }, () => ({ w: String(w), r: String(r) }));

test("starts in device-only mode with a usable A1 form", async () => {
  const { page, errors, ctx } = await openApp(browser, server.url);
  assert.match(await page.textContent("#note"), /未設定 Firebase/);
  assert.equal(await page.locator("#tabs .tab").count(), 4);
  assert.equal(await page.inputValue("#date"), "2026-11-01");
  assert.equal(await page.locator("#f-bench-3-w").count(), 1, "bench has 4 sets");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("typing a set saves it automatically", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.fill("#f-bench-0-w", "60");
  await page.fill("#f-bench-0-r", "8");
  assert.match(await page.textContent("#status"), /未儲存/);
  await waitSaved(page);
  const db = await stored(page);
  assert.deepEqual(Object.keys(db), ["2026-11-01_A1"]);
  assert.deepEqual(db["2026-11-01_A1"].sets.bench[0], { w: "60", r: "8" });
  await ctx.close();
});

test("only numbers and a dot are kept", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.fill("#f-bench-0-w", "6O.5kg");
  assert.equal(await page.inputValue("#f-bench-0-w"), "6.5");
  await ctx.close();
});

test("an empty form is never saved", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.fill("#f-bench-0-w", "5");
  await page.fill("#f-bench-0-w", "");
  await page.waitForTimeout(1600);
  assert.deepEqual(await stored(page), {});
  await ctx.close();
});

test("records survive a reload, including a save cut short by leaving", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.fill("#f-bench-0-w", "70");
  await page.reload(); // before the 1.2 s autosave
  await page.waitForSelector("#f-bench-0-w");
  assert.equal(await page.inputValue("#f-bench-0-w"), "70");
  await ctx.close();
});

test("last time's numbers show as hints and in the 上次 label", async () => {
  const seed = { "2026-10-29_A1": session("2026-10-29", "A1", { bench: [{ w: "55", r: "7" }] }) };
  const { page, ctx } = await openApp(browser, server.url, { seed });
  assert.equal(await page.getAttribute("#f-bench-0-w", "placeholder"), "55");
  assert.equal(await page.getAttribute("#f-bench-0-r", "placeholder"), "7");
  const meta = await page.locator(".ex").first().locator(".meta").textContent();
  assert.match(meta, /上次 10\/29（A1）/);
  await ctx.close();
});

test("可加重 shows only when every target set reached the top of the rep range", async () => {
  // bench target 4 x 6-8
  const hit = { "2026-10-29_A1": session("2026-10-29", "A1", { bench: S4(50, 8) }) };
  let { page, ctx } = await openApp(browser, server.url, { seed: hit });
  assert.equal(await page.locator(".ex").first().locator(".pill").count(), 1);
  await ctx.close();

  const miss = { "2026-10-29_A1": session("2026-10-29", "A1", { bench: [...S4(50, 8).slice(0, 3), { w: "50", r: "7" }] }) };
  ({ page, ctx } = await openApp(browser, server.url, { seed: miss }));
  assert.equal(await page.locator(".ex").first().locator(".pill").count(), 0);
  await ctx.close();

  const short = { "2026-10-29_A1": session("2026-10-29", "A1", { bench: S4(50, 8).slice(0, 3) }) };
  ({ page, ctx } = await openApp(browser, server.url, { seed: short }));
  assert.equal(await page.locator(".ex").first().locator(".pill").count(), 0, "3 of 4 sets is not enough");
  await ctx.close();
});

test("上次 means the latest earlier session, not a later one", async () => {
  const seed = {
    "2026-10-20_A1": session("2026-10-20", "A1", { bench: [{ w: "40", r: "8" }] }),
    "2026-10-25_A1": session("2026-10-25", "A1", { bench: [{ w: "45", r: "8" }] }),
    "2026-10-30_A1": session("2026-10-30", "A1", { bench: [{ w: "50", r: "8" }] }),
  };
  const { page, ctx } = await openApp(browser, server.url, { seed });
  await page.fill("#date", "2026-10-25"); await page.dispatchEvent("#date", "change");
  assert.equal(await page.inputValue("#f-bench-0-w"), "45", "opened the 10/25 record");
  assert.equal(await page.getAttribute("#f-bench-0-w", "placeholder"), "40", "hint comes from 10/20, the session before");
  await ctx.close();
});

test("shared exercises carry over between days (Bicep curl A1 -> B1)", async () => {
  const seed = { "2026-10-30_A1": session("2026-10-30", "A1", { curl: [{ w: "12", r: "13" }] }) };
  const { page, ctx } = await openApp(browser, server.url, { seed });
  await page.click('.tab[data-d="B1"]');
  assert.equal(await page.getAttribute("#f-curl-0-w", "placeholder"), "12");
  assert.match(await page.locator(".ex", { hasText: "Bicep curl" }).locator(".meta").textContent(), /上次 10\/30（A1）/);
  await ctx.close();
});

test("kg / lb switch is kept with the record", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.fill("#f-bench-0-w", "100");
  await page.locator(".ex").first().locator("button.unit").click();
  await waitSaved(page);
  assert.equal((await stored(page))["2026-11-01_A1"].units.bench, "lb");
  assert.equal(await page.locator(".ex").first().locator("button.unit").textContent(), "lb");
  await ctx.close();
});

test("+ 加一組 adds a fifth set that saves", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.locator(".ex").first().locator("button.add").click();
  await page.fill("#f-bench-4-w", "40");
  await waitSaved(page);
  assert.equal((await stored(page))["2026-11-01_A1"].sets.bench.length, 5);
  await ctx.close();
});

test("開新一次 starts a blank form and keeps the earlier record", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.fill("#f-bench-0-w", "20"); await waitSaved(page);
  await page.click("#newBtn");
  assert.equal(await page.inputValue("#f-bench-0-w"), "");
  await page.fill("#f-bench-0-w", "25"); await waitSaved(page);
  const db = await stored(page);
  assert.deepEqual(Object.keys(db).sort(), ["2026-11-01_A1", "2026-11-01_A1_2"]);
  assert.equal(db["2026-11-01_A1"].sets.bench[0].w, "20");
  assert.equal(db["2026-11-01_A1_2"].sets.bench[0].w, "25");
  assert.equal(await page.locator("#hist .h").count(), 2);
  await ctx.close();
});

test("changing the date opens that day and never moves the current record", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.fill("#f-bench-0-w", "20");
  await page.fill("#date", "2026-10-30"); await page.dispatchEvent("#date", "change");
  assert.equal(await page.inputValue("#f-bench-0-w"), "", "blank form for 10/30");
  await page.waitForTimeout(300);
  const db = await stored(page);
  assert.deepEqual(Object.keys(db), ["2026-11-01_A1"], "the 11/01 record stays on 11/01");
  await ctx.close();
});

test("switching tabs saves the current day and shows the other", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  await page.fill("#f-bench-0-w", "60");
  await page.click('.tab[data-d="B1"]');
  assert.equal(await page.locator("#f-squat-0-w").count(), 1);
  await page.fill("#f-squat-0-w", "80");
  await page.click('.tab[data-d="A1"]');
  assert.equal(await page.inputValue("#f-bench-0-w"), "60");
  const db = await stored(page);
  assert.equal(db["2026-11-01_B1"].sets.squat[0].w, "80");
  assert.equal(db["2026-11-01_A1"].sets.squat, undefined, "no cross-over between days");
  await ctx.close();
});

test("history: 打開 an old record, then 刪除 needs a second tap", async () => {
  const seed = { "2026-10-29_A1": session("2026-10-29", "A1", { bench: [{ w: "55", r: "7" }] }) };
  const { page, ctx } = await openApp(browser, server.url, { seed });
  await page.getByRole("button", { name: "打開" }).click();
  assert.equal(await page.inputValue("#f-bench-0-w"), "55");
  assert.equal(await page.inputValue("#date"), "2026-10-29");
  const del = page.getByRole("button", { name: "刪除" });
  await del.click();
  assert.equal(Object.keys(await stored(page)).length, 1, "first tap only asks");
  await page.getByRole("button", { name: "確定刪除？" }).click();
  await page.waitForTimeout(200);
  assert.deepEqual(await stored(page), {});
  assert.equal(await page.inputValue("#f-bench-0-w"), "", "form is blank after deleting the open record");
  await ctx.close();
});

test("export then import round-trips every record", async () => {
  const seed = {
    "2026-10-29_A1": session("2026-10-29", "A1", { bench: [{ w: "55", r: "7" }] }),
    "2026-10-30_B1": session("2026-10-30", "B1", { squat: [{ w: "60", r: "6" }] }),
  };
  const { page, ctx } = await openApp(browser, server.url, { seed });
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
  const exported = JSON.parse(await readFile(await dl.path(), "utf8"));
  assert.equal(exported.length, 2);
  await page.evaluate(() => localStorage.setItem("wlog.sessions", "{}"));
  await page.setInputFiles("#importFile", { name: "b.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForFunction(() => document.getElementById("status").textContent.includes("已匯入"));
  assert.match(await page.textContent("#status"), /已匯入 2 次記錄/);
  assert.deepEqual(Object.keys(await stored(page)).sort(), ["2026-10-29_A1", "2026-10-30_B1"]);
  await ctx.close();
});

test("import rejects a bad file and skips broken rows without crashing", async () => {
  const { page, ctx, errors } = await openApp(browser, server.url);
  await page.setInputFiles("#importFile", { name: "x.json", mimeType: "application/json", buffer: Buffer.from("not json") });
  await page.waitForFunction(() => !document.getElementById("note").hidden && document.getElementById("note").textContent.includes("匯入失敗"));
  const rows = [
    { day: "A1", date: "2026-10-01", sets: { bench: [{ w: "40", r: "8" }] } },
    { day: "A1", sets: {} },                                    // no date
    { day: "A1", date: "2026-10-02", sets: { bench: "oops" } }, // malformed sets
    { day: "ZZ", date: "2026-10-03", sets: {} },                 // unknown day
    null,
  ];
  await page.setInputFiles("#importFile", { name: "y.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(rows)) });
  await page.waitForFunction(() => document.getElementById("status").textContent.includes("已匯入"));
  assert.match(await page.textContent("#status"), /已匯入 1 次記錄/);
  await page.click('.tab[data-d="B1"]'); await page.click('.tab[data-d="A1"]');
  assert.deepEqual(errors, [], "no page errors after importing junk");
  await ctx.close();
});

test("imported text cannot inject HTML", async () => {
  const { page, ctx } = await openApp(browser, server.url);
  const evil = [{ day: "A1", date: "2026-10-01", sets: { bench: [{ w: "<img src=x onerror=window.pwned=1>", r: "8" }] } }];
  await page.setInputFiles("#importFile", { name: "e.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(evil)) });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.equal(await page.locator("#hist img").count(), 0);
  await ctx.close();
});

test("fits a phone screen without sideways scrolling", async () => {
  const { page, ctx } = await openApp(browser, server.url, { viewport: { width: 360, height: 740 } });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 0, `page is ${over}px too wide`);
  await ctx.close();
});
