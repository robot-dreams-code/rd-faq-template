/* r_d FAQ — універсальний шаблон.
   Дані: Google Sheets (вкладки faq і settings) → CSV → сторінка.
   Резервна копія: data/faq.csv і data/settings.csv у репозиторії. */
(function () {
  "use strict";

  var CFG = window.FAQ_CONFIG || {};
  var DEFAULTS = CFG.defaults || {};

  /* ---------- Джерела даних ---------- */

  function sheetCsvUrl(sheetId, tab) {
    return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(tab);
  }

  function liveUrls() {
    return {
      faq: CFG.faqCsvUrl || (CFG.sheetId ? sheetCsvUrl(CFG.sheetId, CFG.faqSheet || "faq") : ""),
      settings: CFG.settingsCsvUrl || (CFG.sheetId ? sheetCsvUrl(CFG.sheetId, CFG.settingsSheet || "settings") : ""),
    };
  }

  function fetchCsv(url) {
    if (!url) return Promise.reject(new Error("URL не задано"));
    return fetch(url, { cache: "no-store", credentials: "omit" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (text) {
      // Якщо таблиця закрита, Google повертає HTML-сторінку входу замість CSV
      if (/^\s*</.test(text)) throw new Error("Отримано HTML замість CSV — перевірте доступ до таблиці");
      return parseCsv(text);
    });
  }

  // Повертає { rows, fromSnapshot }
  function load(kind) {
    var live = liveUrls()[kind];
    var snap = (CFG.snapshot || {})[kind];
    var useLive = CFG.source !== "snapshot" && live;
    if (!useLive) return fetchCsv(snap).then(function (rows) { return { rows: rows, fromSnapshot: true }; });
    return fetchCsv(live).then(
      function (rows) { return { rows: rows, fromSnapshot: false }; },
      function (err) {
        console.warn("[faq] " + kind + ": не вдалося прочитати таблицю (" + err.message + "), беремо копію з репозиторію");
        return fetchCsv(snap).then(function (rows) { return { rows: rows, fromSnapshot: true }; });
      }
    );
  }

  /* ---------- CSV ---------- */

  function parseCsv(text) {
    var rows = [], row = [], field = "", inQuotes = false, i = 0, c;
    text = text.replace(/^\uFEFF/, "");
    while (i < text.length) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // Назви колонок можна писати англійською або українською
  var ALIASES = {
    id: "id", "ід": "id", "якір": "id", anchor: "id",
    category: "category", "категорія": "category", "розділ": "category",
    question: "question", "питання": "question",
    answer: "answer", "відповідь": "answer",
    order: "order", "порядок": "order",
    active: "active", "показувати": "active", "активне": "active",
    key: "key", "ключ": "key",
    value: "value", "значення": "value",
  };

  function toObjects(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) {
      var k = String(h).trim().toLowerCase();
      return ALIASES[k] || k;
    });
    return rows.slice(1).filter(function (r) {
      return r.some(function (v) { return String(v).trim() !== ""; });
    }).map(function (r, idx) {
      var o = { _row: idx };
      head.forEach(function (h, j) { o[h] = r[j] == null ? "" : String(r[j]); });
      return o;
    });
  }

  /* ---------- Налаштування ---------- */

  function readSettings(rows) {
    var s = {};
    Object.keys(DEFAULTS).forEach(function (k) { s[k] = DEFAULTS[k]; });
    toObjects(rows).forEach(function (r) {
      var k = String(r.key || "").trim().toLowerCase();
      var v = String(r.value || "").trim();
      if (k && v) s[k] = v;
    });
    return s;
  }

  function isHex(v) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v || ""); }

  function inkFor(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (x) { return x + x; }).join("");
    var rgb = [0, 2, 4].map(function (i) {
      var c = parseInt(h.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    // контраст з чорним vs білим
    return (L + 0.05) / (0.0094 + 0.05) >= (1.05) / (L + 0.05) ? "#181919" : "#FFFFFF";
  }

  function safeUrl(u) {
    u = String(u || "").trim();
    return /^(https?:|mailto:|tel:)/i.test(u) ? u : "";
  }

  function applySettings(s) {
    var root = document.documentElement;
    if (isHex(s.accent)) {
      root.style.setProperty("--accent", s.accent);
      root.style.setProperty("--accent-ink", inkFor(s.accent));
    }

    $("courseTitle").textContent = s.course_name;
    $("courseSubtitle").textContent = s.course_subtitle || "";
    document.title = "Часті запитання — " + s.course_name;
    var meta = document.querySelector('meta[name="description"]');
    if (meta && s.course_subtitle) meta.setAttribute("content", s.course_subtitle);

    // логотип
    if (CFG.logoSrc) {
      var img = document.createElement("img");
      img.src = CFG.logoSrc; img.alt = "robot_dreams";
      $("brand").replaceChildren(img);
    } else {
      $("subbrand").textContent = s.subbrand || "faq";
    }

    var site = safeUrl(s.site_url);
    if (site) { $("brand").href = site; $("siteLink").href = site; }
    $("siteLink").textContent = s.site_label || "robotdreams.cc";

    var tags = $("heroTags");
    tags.replaceChildren();
    String(s.tags || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean).forEach(function (t, i) {
      var el = document.createElement("span");
      el.className = "pill " + (i === 0 ? "pill--accent" : "pill--paper");
      el.textContent = t;
      tags.appendChild(el);
    });

    var contactUrl = safeUrl(s.contact_url);
    if (contactUrl) {
      $("contactTitle").textContent = s.contact_title || "";
      $("contactBody").textContent = s.contact_text || "";
      $("contactBtn").textContent = s.contact_label || "Написати нам";
      $("contactBtn").href = contactUrl;
      $("contact").hidden = false;
    }
  }

  /* ---------- FAQ ---------- */

  var OFF = /^(false|0|no|ні|нi|hide|приховати)$/i;

  function slug(s) {
    var map = { "а":"a","б":"b","в":"v","г":"h","ґ":"g","д":"d","е":"e","є":"ie","ж":"zh","з":"z","и":"y","і":"i","ї":"i","й":"i","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ь":"","ю":"iu","я":"ia","ы":"y","э":"e","ё":"e","ъ":"" };
    return String(s).toLowerCase().split("").map(function (ch) { return map[ch] != null ? map[ch] : ch; }).join("")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }

  function readFaq(rows) {
    var items = toObjects(rows).filter(function (r) {
      return String(r.question || "").trim() && !OFF.test(String(r.active || "").trim());
    });
    var catOrder = [];
    var used = {};
    items.forEach(function (r) {
      r.category = String(r.category || "").trim() || "Загальні питання";
      if (catOrder.indexOf(r.category) < 0) catOrder.push(r.category);
      var base = slug(r.id || "") || slug(r.question) || "q";
      var id = base, n = 2;
      while (used[id]) id = base + "-" + n++;
      used[id] = true;
      r.id = id;
      var o = parseFloat(String(r.order || "").replace(",", "."));
      r._order = isNaN(o) ? Infinity : o;
    });
    items.sort(function (a, b) {
      return catOrder.indexOf(a.category) - catOrder.indexOf(b.category) ||
        (a._order === b._order ? 0 : a._order < b._order ? -1 : 1) ||
        a._row - b._row;
    });
    return { items: items, categories: catOrder };
  }

  function renderMarkdown(src) {
    var html;
    if (window.marked && window.DOMPurify) {
      html = window.marked.parse(String(src), { gfm: true, breaks: true });
      html = window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    } else {
      html = escapeHtml(src).replace(/\n/g, "<br>");
    }
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    tpl.content.querySelectorAll("a[href]").forEach(function (a) {
      if (!/^#/.test(a.getAttribute("href"))) { a.target = "_blank"; a.rel = "noopener"; }
    });
    return tpl.content;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Стан і рендер ---------- */

  var state = { items: [], categories: [], cat: "", query: "" };
  var nodes = {}; // id -> { el, text, q, body }

  function $(id) { return document.getElementById(id); }

  function norm(s) {
    return String(s).toLowerCase().replace(/[’'ʼ`]/g, "'").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  }

  function buildList() {
    var list = $("list");
    list.replaceChildren();
    nodes = {};

    state.categories.forEach(function (cat) {
      var group = document.createElement("section");
      group.className = "group";
      group.dataset.cat = cat;
      var h = document.createElement("h2");
      h.className = "group-title";
      h.textContent = cat;
      group.appendChild(h);

      state.items.filter(function (it) { return it.category === cat; }).forEach(function (it) {
        group.appendChild(buildItem(it));
      });
      list.appendChild(group);
    });

    var empty = document.createElement("div");
    empty.className = "empty";
    empty.id = "empty";
    empty.hidden = true;
    list.appendChild(empty);
  }

  function buildItem(it) {
    var art = document.createElement("article");
    art.className = "qa";
    art.id = it.id;

    var h = document.createElement("h3");
    h.className = "qa-h";
    var btn = document.createElement("button");
    btn.className = "qa-q";
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "a-" + it.id);
    var qText = document.createElement("span");
    qText.className = "qa-text";
    qText.textContent = it.question.trim();
    var icon = document.createElement("span");
    icon.className = "qa-icon";
    icon.setAttribute("aria-hidden", "true");
    btn.append(qText, icon);
    h.appendChild(btn);

    var a = document.createElement("div");
    a.className = "qa-a";
    a.id = "a-" + it.id;
    a.setAttribute("role", "region");
    a.setAttribute("aria-labelledby", it.id + "-q");
    btn.id = it.id + "-q";
    var inner = document.createElement("div");
    inner.className = "qa-a-in";
    var body = document.createElement("div");
    body.className = "qa-body";
    body.appendChild(renderMarkdown(it.answer || ""));
    var foot = document.createElement("div");
    foot.className = "qa-foot";
    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "pill pill--ghost qa-copy";
    copy.textContent = "Скопіювати посилання";
    copy.addEventListener("click", function () { copyLink(it.id); });
    foot.appendChild(copy);
    inner.append(body, foot);
    a.appendChild(inner);

    art.append(h, a);
    btn.addEventListener("click", function () { toggle(it.id); });

    nodes[it.id] = {
      el: art, btn: btn, q: qText, body: body,
      qRaw: it.question.trim(), bodyHtml: body.innerHTML,
      hay: norm(it.question + " " + body.textContent + " " + it.category),
      cat: it.category,
    };
    return art;
  }

  function setOpen(id, open) {
    var n = nodes[id];
    if (!n) return;
    n.el.classList.toggle("open", open);
    n.btn.setAttribute("aria-expanded", String(open));
  }

  function toggle(id) {
    var n = nodes[id];
    var open = !n.el.classList.contains("open");
    setOpen(id, open);
    if (open) history.replaceState(null, "", "#" + id);
    else if (location.hash === "#" + id) history.replaceState(null, "", location.pathname + location.search);
  }

  function buildCats() {
    var wrap = $("cats");
    wrap.replaceChildren();
    if (state.categories.length < 2) { wrap.hidden = true; return; }
    wrap.hidden = false;
    var all = [{ key: "", label: "Усі питання" }].concat(state.categories.map(function (c) { return { key: c, label: c }; }));
    all.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pill cat";
      b.dataset.cat = c.key;
      b.setAttribute("aria-pressed", String(state.cat === c.key));
      var label = document.createElement("span");
      label.textContent = c.label;
      var n = document.createElement("span");
      n.className = "cat-n";
      n.dataset.n = "";
      b.append(label, n);
      b.addEventListener("click", function () {
        state.cat = c.key;
        wrap.querySelectorAll(".cat").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.cat === state.cat)); });
        apply();
      });
      wrap.appendChild(b);
    });
  }

  function apply() {
    var terms = norm(state.query).split(" ").filter(Boolean);
    var shown = 0;
    var perCat = {};
    var matchedIds = [];

    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      var hit = terms.every(function (t) { return n.hay.indexOf(t) >= 0; });
      if (hit) perCat[n.cat] = (perCat[n.cat] || 0) + 1;
      var visible = hit && (!state.cat || n.cat === state.cat);
      n.el.hidden = !visible;
      // підсвітка
      n.q.textContent = n.qRaw;
      n.body.innerHTML = n.bodyHtml;
      if (visible && terms.length) { highlight(n.q, terms); highlight(n.body, terms); matchedIds.push(id); }
      if (visible) shown++;
    });

    document.querySelectorAll(".group").forEach(function (g) {
      g.hidden = !g.querySelector(".qa:not([hidden])");
    });

    // лічильники в категоріях
    var total = 0;
    Object.keys(perCat).forEach(function (k) { total += perCat[k]; });
    document.querySelectorAll(".cat").forEach(function (b) {
      var n = b.dataset.cat ? (perCat[b.dataset.cat] || 0) : total;
      b.querySelector(".cat-n").textContent = String(n);
      b.disabled = terms.length > 0 && n === 0 && b.dataset.cat !== state.cat;
    });

    // під час пошуку відкриваємо відповіді, якщо збігів небагато
    if (terms.length && matchedIds.length <= 3) matchedIds.forEach(function (id) { setOpen(id, true); });

    $("count").textContent = terms.length
      ? (shown ? "Знайдено: " + shown : "")
      : "";

    var empty = $("empty");
    if (!shown) {
      empty.replaceChildren();
      var t = document.createElement("h2");
      t.className = "empty-title";
      t.textContent = "Нічого не знайшли";
      var p = document.createElement("p");
      p.textContent = state.query
        ? "За запитом «" + state.query.trim() + "» немає відповідей. Спробуйте інше слово або перегляньте всі питання."
        : "У цій категорії поки немає питань.";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pill pill--ink";
      b.textContent = "Показати всі питання";
      b.addEventListener("click", resetFilters);
      empty.append(t, p, b);
      empty.hidden = false;
    } else {
      empty.hidden = true;
    }
  }

  function resetFilters() {
    state.query = ""; state.cat = "";
    $("q").value = "";
    syncSearchUi();
    document.querySelectorAll(".cat").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.cat === "")); });
    apply();
    $("q").focus();
  }

  function highlight(root, terms) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    var re = new RegExp("(" + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
    textNodes.forEach(function (tn) {
      var v = tn.nodeValue;
      re.lastIndex = 0;
      if (!re.test(v)) return;
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = re.exec(v))) {
        if (m.index > last) frag.appendChild(document.createTextNode(v.slice(last, m.index)));
        var mark = document.createElement("mark");
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      if (last < v.length) frag.appendChild(document.createTextNode(v.slice(last)));
      tn.parentNode.replaceChild(frag, tn);
    });
  }

  /* ---------- Посилання, тост ---------- */

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function copyLink(id) {
    var url = location.origin + location.pathname + "#" + id;
    var done = function () { toast("Посилання скопійовано"); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt("Скопіюйте посилання:", url); });
    } else {
      window.prompt("Скопіюйте посилання:", url);
    }
  }

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var n = nodes[id];
    if (!n) return;
    if (n.el.hidden) resetFilters();
    setOpen(id, true);
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    n.el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    n.el.classList.add("flash");
    setTimeout(function () { n.el.classList.remove("flash"); }, 1600);
    n.btn.focus({ preventScroll: true });
  }

  /* ---------- Пошук ---------- */

  function syncSearchUi() {
    var has = $("q").value.length > 0;
    $("qClear").hidden = !has;
    $("q").parentElement.classList.toggle("has-value", has);
  }

  function initSearch() {
    var input = $("q");
    var timer;
    input.addEventListener("input", function () {
      syncSearchUi();
      clearTimeout(timer);
      timer = setTimeout(function () { state.query = input.value; apply(); }, 120);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value) { e.preventDefault(); resetFilters(); }
    });
    $("qClear").addEventListener("click", resetFilters);
    document.addEventListener("keydown", function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); input.focus();
      }
    });
  }

  /* ---------- Тема ---------- */

  function initTheme() {
    $("themeBtn").addEventListener("click", function () {
      var root = document.documentElement;
      var current = root.dataset.theme ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = current === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("rd-faq-theme", next); } catch (e) {}
    });
  }

  /* ---------- Помилка ---------- */

  function showError() {
    var list = $("list");
    list.replaceChildren();
    var box = document.createElement("div");
    box.className = "empty";
    var t = document.createElement("h2");
    t.className = "empty-title";
    t.textContent = "Не вдалося завантажити питання";
    var p = document.createElement("p");
    p.textContent = "Оновіть сторінку за хвилину. Якщо помилка повторюється, напишіть нам — відповімо напряму.";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "pill pill--ink";
    b.textContent = "Оновити сторінку";
    b.addEventListener("click", function () { location.reload(); });
    box.append(t, p, b);
    list.appendChild(box);
  }

  /* ---------- Старт ---------- */

  function start() {
    initTheme();
    initSearch();

    var settingsP = load("settings").catch(function () { return { rows: [], fromSnapshot: true }; });
    var faqP = load("faq");

    settingsP.then(function (s) { applySettings(readSettings(s.rows)); });

    Promise.all([faqP, settingsP]).then(function (res) {
      var faq = readFaq(res[0].rows);
      state.items = faq.items;
      state.categories = faq.categories;
      buildList();
      buildCats();
      apply();
      $("sourceNote").hidden = !res[0].fromSnapshot || CFG.source === "snapshot";
      if (location.hash) openFromHash();
    }).catch(function (err) {
      console.error("[faq]", err);
      applySettings(readSettings([]));
      showError();
    });

    window.addEventListener("hashchange", openFromHash);
  }

  // для тестів у Node
  if (typeof module !== "undefined") module.exports = { parseCsv: parseCsv, toObjects: toObjects, readFaq: readFaq, readSettings: readSettings, slug: slug, inkFor: inkFor };
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
