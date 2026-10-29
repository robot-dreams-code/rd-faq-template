// Завантажує вкладки faq і settings з Google Sheets у data/*.csv.
// Запускається GitHub Action за розкладом; можна запустити й локально: node scripts/sync.mjs
import fs from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(await fs.readFile(new URL("config.js", root), "utf8"), ctx);
const cfg = ctx.window.FAQ_CONFIG || {};

const gviz = (tab) =>
  `https://docs.google.com/spreadsheets/d/${encodeURIComponent(cfg.sheetId)}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}`;

const sources = {
  faq: cfg.faqCsvUrl || (cfg.sheetId && gviz(cfg.faqSheet || "faq")),
  settings: cfg.settingsCsvUrl || (cfg.sheetId && gviz(cfg.settingsSheet || "settings")),
};
const targets = cfg.snapshot || { faq: "data/faq.csv", settings: "data/settings.csv" };

if (!sources.faq) {
  console.log("sheetId не задано в config.js — синхронізацію пропущено.");
  process.exit(0);
}

let failed = false;
for (const [kind, url] of Object.entries(sources)) {
  if (!url) continue;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error("отримано HTML замість CSV — таблиця не відкрита за посиланням?");
    const firstLine = text.split("\n")[0].toLowerCase();
    if (kind === "faq" && !/question|питання/.test(firstLine)) throw new Error("немає колонки question/питання");
    const path = new URL(targets[kind], root);
    const old = await fs.readFile(path, "utf8").catch(() => "");
    if (old === text) { console.log(`${kind}: без змін`); continue; }
    await fs.writeFile(path, text);
    console.log(`${kind}: оновлено (${text.length} байт)`);
  } catch (e) {
    failed = true;
    console.error(`${kind}: ${e.message}. Стара копія залишається.`);
  }
}
process.exit(failed ? 1 : 0);
