/* Shared by every page: data loading, theme toggle, BibTeX dialog, live counts, and section highlighting. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Old links pointed list filters at the site root (e.g. "/#cat=formation"); send them to the list page.
  if (document.body.dataset.page === "overview" && /(^|[#&])(q|cat|year|code|sort)=/.test(location.hash)) {
    location.replace("papers.html" + location.hash);
    return;
  }

  // ---------- data ----------
  const data = fetch("papers.json").then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
  window.AEDA = { data };

  // ---------- theme ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };
  const savedTheme = store.get("aeda-theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  const themeBtn = $("theme");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      const next = dark ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      store.set("aeda-theme", next);
    });
  }

  // ---------- BibTeX dialog ----------
  let BIBTEX = "";
  const dlg = $("bibtex-dialog"), bibCode = $("bibtex-code"), bibStatus = $("bibtex-status");
  function openBibtex() {
    bibCode.textContent = BIBTEX || "BibTeX is still loading…";
    bibStatus.textContent = "";
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  async function copyText(text, codeEl, statusEl) {
    try {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = "Copied to clipboard";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      statusEl.textContent = "Selected — press Ctrl+C (⌘C) to copy";
    }
  }
  if (dlg) {
    document.addEventListener("click", (e) => { if (e.target.closest("[data-open-bibtex]")) openBibtex(); });
    // Clicks on the backdrop land on the <dialog> itself; clicks on its content land inside .dialog-inner.
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
    $("bibtex-copy").addEventListener("click", () => copyText(BIBTEX, bibCode, bibStatus));
  }
  // Inline citation block (overview page).
  const inlineCode = $("cite-code"), inlineCopy = $("cite-copy");
  if (inlineCopy) inlineCopy.addEventListener("click", () => copyText(BIBTEX, inlineCode, $("cite-status")));

  // ---------- counts: <span data-count="formation.semantic"> or data-count="all" / "code" ----------
  data.then((d) => {
    BIBTEX = d.citation || "";
    if (inlineCode) inlineCode.textContent = BIBTEX;
    const parent = {};
    for (const c of d.categories) parent[c.id] = c.parent;
    const inCat = (p, id) => p.categories.some((c) => c === id || parent[c] === id);
    document.querySelectorAll("[data-count]").forEach((el) => {
      const id = el.dataset.count;
      const n = id === "all" ? d.papers.length
        : id === "code" ? d.papers.filter((p) => p.code).length
        : d.papers.filter((p) => inCat(p, id)).length;
      el.textContent = String(n);
    });
  }).catch(() => { /* counts stay as their static fallbacks */ });

  // ---------- table of contents: highlight the section in view ----------
  // The active entry is the last target whose top has scrolled past a line just below the sticky nav.
  const tocLinks = [...document.querySelectorAll(".toc a[href^='#']")];
  const targets = tocLinks.map((a) => document.getElementById(a.getAttribute("href").slice(1)));
  if (tocLinks.length) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const line = 120;
      let current = 0;
      targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top <= line) current = i; });
      // At the very bottom, the last sections can never reach the line, so highlight the last one.
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = targets.length - 1;
      tocLinks.forEach((a, i) => a.classList.toggle("active", i === current));
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
})();
