(() => {
  "use strict";

  const STAGE_COLOR = {
    surveys: "--base", foundations: "--base", formation: "--formation", organization: "--organization",
    utilization: "--utilization", maintenance: "--maintenance", evaluation: "--evaluation", app: "--app",
  };
  const $ = (id) => document.getElementById(id);
  const els = {
    q: $("q"), sort: $("sort"), stages: $("stages"), subcats: $("subcats"), years: $("years"),
    hascode: $("hascode"), reset: $("reset"), list: $("list"), count: $("count"), empty: $("empty"),
    stats: $("stats"), catdesc: $("catdesc"),
  };
  const state = { q: "", stage: "all", sub: "", year: "", code: false, sort: "new" };
  let CATS = {}, TOPS = [], PAPERS = [];

  // ---------- helpers ----------
  const topOf = (cid) => (CATS[cid] && CATS[cid].parent) || cid;
  const firstYear = (p) => (p.date ? +p.date.slice(0, 4) : p.year);
  const yearBucket = (p) => (firstYear(p) <= 2022 ? "≤2022" : String(firstYear(p)));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const terms = () => state.q.toLowerCase().split(/\s+/).filter(Boolean);
  function highlight(text) {
    const ts = terms();
    if (!ts.length) return esc(text);
    const re = new RegExp("(" + ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    return String(text ?? "").split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join("");
  }
  function stripName(title, name) {
    const i = title.indexOf(":");
    if (i < 0) return title;
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const raw = title.slice(0, i), head = norm(raw), n = norm(name);
    const short = raw.trim().split(/\s+/).length <= 4;
    return short && head && (n.includes(head) || head.includes(n)) ? title.slice(i + 1).trim() : title;
  }

  // ---------- URL state ----------
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    state.q = h.get("q") || "";
    state.sub = h.get("cat") && CATS[h.get("cat")] && CATS[h.get("cat")].parent ? h.get("cat") : "";
    state.stage = state.sub ? topOf(state.sub) : (h.get("cat") && CATS[h.get("cat")] ? h.get("cat") : "all");
    state.year = h.get("year") || "";
    state.code = h.get("code") === "1";
    state.sort = ["new", "old", "name"].includes(h.get("sort")) ? h.get("sort") : "new";
  }
  function writeHash() {
    const h = new URLSearchParams();
    if (state.q) h.set("q", state.q);
    const cat = state.sub || (state.stage !== "all" ? state.stage : "");
    if (cat) h.set("cat", cat);
    if (state.year) h.set("year", state.year);
    if (state.code) h.set("code", "1");
    if (state.sort !== "new") h.set("sort", state.sort);
    const s = h.toString();
    history.replaceState(null, "", s ? "#" + s : location.pathname + location.search);
  }

  // ---------- filtering ----------
  function matches(p, { ignore } = {}) {
    if (ignore !== "stage" && state.stage !== "all" && !p.categories.some((c) => topOf(c) === state.stage)) return false;
    if (ignore !== "stage" && state.sub && !p.categories.includes(state.sub)) return false;
    if (ignore !== "year" && state.year && yearBucket(p) !== state.year) return false;
    if (state.code && !p.code) return false;
    const ts = terms();
    if (ts.length) {
      const hay = p._hay;
      if (!ts.every((t) => hay.includes(t))) return false;
    }
    return true;
  }

  // ---------- rendering ----------
  function renderStats() {
    const withCode = PAPERS.filter((p) => p.code).length;
    const years = PAPERS.map(firstYear);
    els.stats.innerHTML =
      `<span><b>${PAPERS.length}</b>papers</span>` +
      `<span><b>${withCode}</b>with code</span>` +
      `<span><b>${Object.values(CATS).filter((c) => c.parent).length}</b>subcategories</span>` +
      `<span><b>${Math.min(...years)}–${Math.max(...years)}</b>years covered</span>`;
  }

  function renderStages() {
    const base = PAPERS.filter((p) => matches(p, { ignore: "stage" }));
    const count = (sid) => base.filter((p) => p.categories.some((c) => topOf(c) === sid)).length;
    const btn = (id, label, n) =>
      `<button class="tab" type="button" data-stage="${id}" aria-pressed="${state.stage === id}">${esc(label)}<span class="n">${n}</span></button>`;
    els.stages.innerHTML = btn("all", "All", base.length) +
      TOPS.map((t) => btn(t.id, `${t.emoji ? t.emoji + " " : ""}${t.title.replace(/ and .*/, "").replace(/^Experience /, "")}`, count(t.id))).join("");
  }

  function renderSubcats() {
    if (state.stage === "all") { els.subcats.innerHTML = ""; return; }
    const children = Object.values(CATS).filter((c) => c.parent === state.stage);
    if (!children.length) { els.subcats.innerHTML = ""; return; }
    const base = PAPERS.filter((p) => matches(p, { ignore: "stage" }));
    els.subcats.innerHTML = `<button class="chip" type="button" data-sub="" aria-pressed="${!state.sub}">All ${esc(CATS[state.stage].title.replace(/^Experience /, "").toLowerCase())}</button>` +
      children.map((c) => {
        const n = base.filter((p) => p.categories.includes(c.id)).length;
        return `<button class="chip" type="button" data-sub="${c.id}" aria-pressed="${state.sub === c.id}">${esc(c.title)} <span class="n">${n}</span></button>`;
      }).join("");
  }

  function renderYears() {
    const buckets = [...new Set(PAPERS.map(yearBucket))].sort((x, y) => (y.startsWith("≤") ? -1 : x.startsWith("≤") ? 1 : y.localeCompare(x)));
    els.years.innerHTML = `<button class="chip" type="button" data-year="" aria-pressed="${!state.year}">Any year</button>` +
      buckets.map((y) => `<button class="chip" type="button" data-year="${y}" aria-pressed="${state.year === y}">${y}</button>`).join("");
  }

  function card(p) {
    const primary = topOf(p.categories[0]);
    const color = STAGE_COLOR[primary] || "--base";
    const title = stripName(p.title, p.name);
    const tags = p.categories.map((c) => {
      const col = STAGE_COLOR[topOf(c)] || "--base";
      return `<button class="tag" type="button" data-cat="${c}" style="--c: var(${col})" title="${esc(CATS[c] ? CATS[c].description : "")}">${esc(CATS[c] ? CATS[c].title : c)}</button>`;
    }).join("");
    const meta = [p.venue ? `<span class="venue">${esc(p.venue)}</span>` : "", p.authors ? esc(p.authors) : "", p.date ? `first public ${esc(p.date)}` : ""]
      .filter(Boolean).join(" · ");
    return `<li class="card" style="--stage: var(${color})">
      <div class="card-head"><span class="card-name">${highlight(p.name)}</span><span class="card-meta">${meta}</span></div>
      <div class="card-title">${p.paper ? `<a href="${esc(p.paper)}" target="_blank" rel="noopener">${highlight(title)}</a>` : highlight(title)}</div>
      ${p.note ? `<p class="card-note">${highlight(p.note)}</p>` : ""}
      <div class="card-foot">${tags}<span class="links">${p.paper ? `<a href="${esc(p.paper)}" target="_blank" rel="noopener">Paper ↗</a>` : ""}${p.code ? `<a href="${esc(p.code)}" target="_blank" rel="noopener">Code ↗</a>` : ""}</span></div>
    </li>`;
  }

  function renderList() {
    let items = PAPERS.filter((p) => matches(p));
    const dkey = (p) => p.date || String(p.year);
    if (state.sort === "new") items.sort((a, b) => dkey(b).localeCompare(dkey(a)) || a.name.localeCompare(b.name));
    if (state.sort === "old") items.sort((a, b) => dkey(a).localeCompare(dkey(b)) || a.name.localeCompare(b.name));
    if (state.sort === "name") items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    els.list.innerHTML = items.map(card).join("");
    els.empty.hidden = items.length > 0;
    els.count.textContent = `${items.length} of ${PAPERS.length} papers`;
    const cat = state.sub || (state.stage !== "all" ? state.stage : "");
    els.catdesc.textContent = cat && CATS[cat] ? CATS[cat].description : "";
  }

  function render() {
    els.q.value = state.q;
    els.sort.value = state.sort;
    els.hascode.checked = state.code;
    renderStages(); renderSubcats(); renderYears(); renderList();
    writeHash();
  }

  // ---------- events ----------
  let t;
  els.q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = els.q.value.trim(); render(); }, 120); });
  els.sort.addEventListener("change", () => { state.sort = els.sort.value; render(); });
  els.hascode.addEventListener("change", () => { state.code = els.hascode.checked; render(); });
  els.reset.addEventListener("click", () => { Object.assign(state, { q: "", stage: "all", sub: "", year: "", code: false, sort: "new" }); render(); });
  els.stages.addEventListener("click", (e) => {
    const b = e.target.closest("[data-stage]"); if (!b) return;
    state.stage = b.dataset.stage; state.sub = ""; render();
  });
  els.subcats.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sub]"); if (!b) return;
    state.sub = b.dataset.sub; render();
  });
  els.years.addEventListener("click", (e) => {
    const b = e.target.closest("[data-year]"); if (!b) return;
    state.year = b.dataset.year; render();
  });
  els.list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    const c = b.dataset.cat;
    if (CATS[c].parent) { state.stage = CATS[c].parent; state.sub = c; } else { state.stage = c; state.sub = ""; }
    render();
    els.stages.scrollIntoView({ block: "nearest" });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== els.q) { e.preventDefault(); els.q.focus(); }
  });
  window.addEventListener("hashchange", () => { readHash(); render(); });

  // ---------- boot ----------
  window.AEDA.data
    .then((data) => {
      for (const c of data.categories) CATS[c.id] = c;
      TOPS = data.categories.filter((c) => !c.parent);
      PAPERS = data.papers.map((p) => ({ ...p, _hay: [p.name, p.title, p.authors, p.note, p.venue].join(" ").toLowerCase() }));
      renderStats(); readHash(); render();
    })
    .catch((err) => {
      els.count.textContent = "Could not load papers.json (" + err.message + ").";
    });
})();
