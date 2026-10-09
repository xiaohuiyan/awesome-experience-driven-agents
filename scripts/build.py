#!/usr/bin/env python3
"""Validate data/papers.yaml and render README.md + docs/papers.json.

Usage:
    python scripts/build.py           # rebuild README.md and docs/papers.json
    python scripts/build.py --check   # fail if the generated files are out of date (used in CI)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
TAXONOMY = ROOT / "data" / "taxonomy.yaml"
PAPERS = ROOT / "data" / "papers.yaml"
TEMPLATE = ROOT / "scripts" / "README.template.md"
README = ROOT / "README.md"
SITE_DATA = ROOT / "docs" / "papers.json"

REQUIRED = ("id", "name", "title", "year", "categories")
GITHUB_RE = re.compile(r"^https://github\.com/([\w.-]+/[\w.-]+?)/?$")


def load_taxonomy():
    tax = yaml.safe_load(TAXONOMY.read_text(encoding="utf-8"))
    order, info = [], {}
    for top in tax:
        info[top["id"]] = {**top, "parent": None}
        order.append(top["id"])
        for child in top.get("children", []):
            info[child["id"]] = {**child, "parent": top["id"]}
            order.append(child["id"])
    return tax, order, info


def validate(papers, info):
    errors, seen = [], set()
    for i, p in enumerate(papers):
        where = f"papers.yaml entry #{i + 1} ({p.get('id', '?')})"
        for field in REQUIRED:
            if not p.get(field):
                errors.append(f"{where}: missing '{field}'")
        if p.get("id") in seen:
            errors.append(f"{where}: duplicate id")
        seen.add(p.get("id"))
        for c in p.get("categories", []):
            if c not in info:
                errors.append(f"{where}: unknown category '{c}'")
            elif info[c].get("children"):
                errors.append(f"{where}: '{c}' has subcategories; use one of them")
        if p.get("code") and not GITHUB_RE.match(p["code"]) and not p["code"].startswith("https://"):
            errors.append(f"{where}: code link must be an https URL")
        if p.get("paper") and not p["paper"].startswith(("https://", "http://")):
            errors.append(f"{where}: paper link must be a URL")
    return errors


def sort_key(p):
    return (p.get("date") or str(p["year"]), p["name"].lower())


def strip_name(title: str, name: str) -> str:
    """Drop a leading 'Name:' from the title when it repeats the display name."""
    head, sep, rest = title.partition(":")
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())  # noqa: E731
    short = len(head.split()) <= 4  # a system name, not a descriptive phrase such as "A Survey of ..."
    if sep and rest.strip() and short and norm(head) and (norm(head) in norm(name) or norm(name) in norm(head)):
        return rest.strip()
    return title


def anchor(text: str) -> str:
    """GitHub-style heading anchor."""
    a = text.strip().lower()
    a = re.sub(r"[^\w\- ]", "", a, flags=re.UNICODE)
    return a.replace(" ", "-")


def render_entry(p) -> str:
    title = strip_name(p["title"], p["name"])
    link = f"[{title}]({p['paper']})" if p.get("paper") else title
    bits = [f"- **{p['name']}** · {link}"]
    meta = []
    if p.get("venue"):
        meta.append(f"*{p['venue']}*")
    if p.get("code"):
        m = GITHUB_RE.match(p["code"])
        code = f"[code]({p['code']})"
        if m:
            code += f" ![](https://img.shields.io/github/stars/{m.group(1)}?style=flat-square&label=%E2%AD%90&color=lightgrey)"
        meta.append(code)
    if meta:
        bits.append(" · " + " · ".join(meta))
    line = "".join(bits)
    if p.get("note"):
        line += f"<br><sub>{p['note']}</sub>"
    return line


def render_readme(tax, order, info, papers):
    by_cat = defaultdict(list)
    for p in papers:
        for c in p["categories"]:
            by_cat[c].append(p)

    toc, body = [], []
    for top in tax:
        tid = top["id"]
        heading = f"{top.get('emoji', '')} {top['title']}".strip()
        toc.append(f"- [{top['title']}](#{anchor(heading)})")
        body.append(f"## {heading}\n")
        body.append(f"{top['description'].strip()}\n")
        children = top.get("children", [])
        if not children:
            items = sorted(by_cat[tid], key=sort_key, reverse=True)
            body.extend(render_entry(p) for p in items)
            body.append("")
        for child in children:
            cid = child["id"]
            toc.append(f"  - [{child['title']}](#{anchor(child['title'])})")
            items = sorted(by_cat[cid], key=sort_key, reverse=True)
            body.append(f"### {child['title']}\n")
            body.append(f"*{child['description'].strip()}*\n")
            body.extend(render_entry(p) for p in items)
            body.append("")
        body.append('<p align="right"><a href="#contents">back to top ↑</a></p>\n')

    template = TEMPLATE.read_text(encoding="utf-8")
    n_code = sum(1 for p in papers if p.get("code"))
    out = (template
           .replace("{{TOC}}", "\n".join(toc))
           .replace("{{PAPERS}}", "\n".join(body).rstrip() + "\n")
           .replace("{{N_PAPERS}}", str(len(papers)))
           .replace("{{N_CODE}}", str(n_code)))
    return out


def render_site_data(order, info, papers):
    cats = []
    for cid in order:
        c = info[cid]
        cats.append({"id": cid, "title": c["title"], "parent": c["parent"],
                     "description": c["description"].strip(), "emoji": c.get("emoji", "")})
    items = []
    for p in sorted(papers, key=sort_key, reverse=True):
        items.append({k: p.get(k) for k in
                      ("id", "name", "title", "authors", "venue", "year", "date", "paper", "code", "note", "categories")})
    return json.dumps({"categories": cats, "papers": items}, ensure_ascii=False, indent=1) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify generated files are up to date")
    args = ap.parse_args()

    tax, order, info = load_taxonomy()
    papers = yaml.safe_load(PAPERS.read_text(encoding="utf-8")) or []
    errors = validate(papers, info)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    outputs = {README: render_readme(tax, order, info, papers),
               SITE_DATA: render_site_data(order, info, papers)}
    if args.check:
        stale = [str(f.relative_to(ROOT)) for f, text in outputs.items()
                 if not f.exists() or f.read_text(encoding="utf-8") != text]
        if stale:
            print("Out of date: " + ", ".join(stale) + "\nRun: python scripts/build.py", file=sys.stderr)
            sys.exit(1)
        print(f"OK: {len(papers)} papers, generated files up to date.")
        return
    for f, text in outputs.items():
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text, encoding="utf-8", newline="\n")
    print(f"Built README.md and docs/papers.json from {len(papers)} papers.")


if __name__ == "__main__":
    main()
