#!/usr/bin/env python3
"""Render the guide pages from tools/guides/*.json into guides/<slug>.html and guides/index.html.

Each JSON file is one page: title, slug, description, lede, sections (heading plus rows of term and
text, or paragraphs), questions, sources and dates. The template is the site's own markup, so a
guide looks like the rest of the site and shares style.css. Run after editing a guide:
    python3 tools/build-guides.py && python3 tools/check-asset-names.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "tools" / "guides"
OUT = ROOT / "guides"
SITE = "https://smarthomeqr.vishutdhar.com"


def esc(text):
    return html.escape(text, quote=True)


def inline(text):
    """Plain text with [label](url) links and the app's name left as is."""
    def link(m):
        href = m.group(2)
        rel = "" if href.startswith("/") or href.startswith(SITE) else ' rel="noopener"'
        return f'<a href="{esc(href)}"{rel}>{esc(m.group(1))}</a>'
    parts = []
    pos = 0
    for m in re.finditer(r"\[([^\]]+)\]\(([^)]+)\)", text):
        parts.append(esc(text[pos:m.start()]))
        parts.append(link(m))
        pos = m.end()
    parts.append(esc(text[pos:]))
    return "".join(parts)


def render_section(section):
    out = [f'    <section class="section" id="{esc(section["id"])}" aria-labelledby="{esc(section["id"])}-title">',
           '      <div class="wrap">',
           '        <div class="section-head">',
           f'          <h2 id="{esc(section["id"])}-title">{inline(section["heading"])}</h2>']
    if section.get("lede"):
        out.append(f'          <p class="lede">{inline(section["lede"])}</p>')
    out.append('        </div>')
    if section.get("rows"):
        out.append('        <dl class="rows">')
        for row in section["rows"]:
            out.append('          <div class="row">')
            out.append(f'            <dt class="row-term">{inline(row["term"])}</dt>')
            out.append(f'            <dd>{inline(row["text"])}</dd>')
            out.append('          </div>')
        out.append('        </dl>')
    if section.get("paragraphs"):
        out.append('        <div class="prose">')
        for p in section["paragraphs"]:
            out.append(f'          <p>{inline(p)}</p>')
        out.append('        </div>')
    out.append('      </div>')
    out.append('    </section>')
    return "\n".join(out)


def render_questions(questions):
    if not questions:
        return ""
    out = ['    <section class="section" id="questions" aria-labelledby="faq-title">',
           '      <div class="wrap">',
           '        <div class="section-head">',
           '          <h2 id="faq-title">Questions</h2>',
           '        </div>',
           '        <dl class="rows">']
    for q in questions:
        out.append('          <div class="row">')
        out.append(f'            <dt class="row-term">{inline(q["q"])}</dt>')
        out.append(f'            <dd>{inline(q["a"])}</dd>')
        out.append('          </div>')
    out += ['        </dl>', '      </div>', '    </section>']
    return "\n".join(out)


def render_sources(sources, read):
    if not sources:
        return ""
    out = ['    <section class="section sources" id="sources" aria-labelledby="sources-title">',
           '      <div class="wrap">',
           '        <div class="section-head">',
           '          <h2 id="sources-title">Sources</h2>',
           f'          <p class="lede">Each page below was read on {esc(read)}. Makers move their pages; if one is gone, their support site has the current one.</p>',
           '        </div>',
           '        <ul class="source-list">']
    for s in sources:
        out.append(f'          <li><a href="{esc(s["url"])}" rel="noopener">{esc(s["label"])}</a></li>')
    out += ['        </ul>', '      </div>', '    </section>']
    return "\n".join(out)


def strip_links(text):
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)


def json_ld(page):
    url = f"{SITE}/guides/{page['slug']}"
    graph = [
        {
            "@type": "Article",
            "@id": url + "#article",
            "headline": page["title"],
            "description": page["description"],
            "url": url,
            "datePublished": page["published"],
            "dateModified": page.get("modified", page["published"]),
            "author": {"@type": "Organization", "name": "Freedom Terminal", "url": "https://freedom-terminal.com/"},
            "publisher": {"@type": "Organization", "name": "Freedom Terminal", "url": "https://freedom-terminal.com/"},
            "isPartOf": {"@id": f"{SITE}/#website"},
            "about": page.get("about", "Smart home setup codes"),
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "SmartHomeQR", "item": f"{SITE}/"},
                {"@type": "ListItem", "position": 2, "name": "Guides", "item": f"{SITE}/guides"},
                {"@type": "ListItem", "position": 3, "name": page["short"], "item": url},
            ],
        },
    ]
    if page.get("questions"):
        graph.append({
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": strip_links(q["q"]),
                 "acceptedAnswer": {"@type": "Answer", "text": strip_links(q["a"])}}
                for q in page["questions"]
            ],
        })
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, indent=2, ensure_ascii=False)


HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} | SmartHomeQR</title>
  <meta name="description" content="{description}">
  <link rel="canonical" href="{url}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#F2F2F7" media="(prefers-color-scheme: light)">
  <meta name="color-scheme" content="dark light">
  <meta name="format-detection" content="telephone=no">
  <link rel="icon" type="image/png" sizes="64x64" href="../images/favicon-64.18bc72ef.png">
  <link rel="apple-touch-icon" href="../images/apple-touch-icon.4c9713b6.png">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="SmartHomeQR">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{site}/images/og.fa189b3f.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="A HomeKit style setup code sticker beside the line Lost a HomeKit or Matter setup code?">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{site}/images/og.fa189b3f.png">
  <link rel="preload" href="../fonts/schibsted-grotesk-700-latin.519f310a.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../fonts/schibsted-grotesk-400-latin.a1b49272.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../style.css">
</head>
<body class="guide-page">
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="wrap header-row">
      <a class="wordmark" href="../">
        <img src="../images/icon-56.9eebb22e.webp" alt="" width="28" height="28">
        <span>SmartHomeQR</span>
      </a>
      <nav aria-label="Site">
        <ul class="nav-links">
          <li><a href="../guides">Guides</a></li>
          <li><a href="../matter-qr-code-decoder">Decoder</a></li>
          <li><a href="../#pricing">The app</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main id="main">

    <section class="hero guide-hero" aria-labelledby="hero-title">
      <div class="wrap">
        <p class="crumb"><a href="../guides">Guides</a></p>
        <h1 id="hero-title">{h1}</h1>
        <p class="lede">{lede}</p>
        <p class="fine">{dateline}</p>
      </div>
    </section>

"""

TAIL = """
    <section class="section cta" aria-labelledby="cta-title">
      <div class="wrap pricing-grid">
        <div class="pricing-lead">
          <h2 id="cta-title">{cta_title}</h2>
          <p class="lede">{cta_text}</p>
          <div class="actions">
            <a class="button button-primary" href="https://apps.apple.com/app/smarthomeqr/id6756529233">Download on the App Store</a>
            <a class="button button-secondary" href="https://play.google.com/store/apps/details?id=com.vishutdhar.smarthomeqr">Get it on Google Play</a>
          </div>
        </div>
      </div>
    </section>

  </main>

  <footer class="site-footer">
    <div class="wrap">
      <p class="footer-support">A fact on this page that is out of date, or a brand it should cover: write to <a href="mailto:support@freedom-terminal.com">support@freedom-terminal.com</a>.</p>
      <div class="footer-row">
        <ul class="footer-links">
          <li><a href="../">SmartHomeQR</a></li>
          <li><a href="../guides">Guides</a></li>
          <li><a href="../matter-qr-code-decoder">Decoder</a></li>
          <li><a href="../privacy">Privacy</a></li>
          <li><a href="mailto:support@freedom-terminal.com">Support</a></li>
          <li><a href="https://freedom-terminal.com/">A Freedom Terminal product</a></li>
        </ul>
        <div class="badges">
          <a class="badge" href="https://apps.apple.com/app/smarthomeqr/id6756529233"><img src="../images/app-store-badge.6c5c68cc.svg" alt="Download on the App Store" width="120" height="40"></a>
          <a class="badge" href="https://play.google.com/store/apps/details?id=com.vishutdhar.smarthomeqr"><img src="../images/google-play-badge.446c2320.png" alt="Get it on Google Play" width="135" height="40"></a>
        </div>
      </div>
      <p class="fine">SmartHomeQR is an independent app and is not affiliated with Apple Inc., Google LLC, Amazon.com, Inc., Samsung Electronics, the Connectivity Standards Alliance or any device maker named on this page. Brand names belong to their owners and are used only to identify their products. App Store and HomeKit are trademarks of Apple Inc. Google Play is a trademark of Google LLC. Matter is a trademark of the Connectivity Standards Alliance.</p>
      <p class="fine">&copy; 2026 Vishut Dhar</p>
    </div>
  </footer>

  <script type="application/ld+json">
{json_ld}
  </script>
</body>
</html>
"""


def render(page):
    url = f"{SITE}/guides/{page['slug']}"
    dateline = f"Checked against the makers' own pages on {page['read']}."
    body = [HEAD.format(title=esc(page["title"]), description=esc(page["description"]), url=url, site=SITE,
                        h1=inline(page["title"]), lede=inline(page["lede"]), dateline=esc(dateline))]
    for section in page["sections"]:
        body.append(render_section(section))
        body.append("")
    body.append(render_questions(page.get("questions")))
    body.append("")
    body.append(render_sources(page.get("sources"), page["read"]))
    body.append(TAIL.format(cta_title=esc(page.get("cta_title", "Next time, have the code on your phone")),
                            cta_text=esc(page.get("cta_text", "SmartHomeQR scans each label once and keeps every HomeKit, Matter and Z Wave code, by home and room, on iPhone, iPad, Apple Watch and Android. Offline, no account. Free for 5 devices.")),
                            json_ld=json_ld(page)))
    return "\n".join(body)


INDEX_HEAD = HEAD


def render_index(pages):
    url = f"{SITE}/guides"
    head = HEAD.format(title="Guides to HomeKit and Matter setup codes", description="Where each brand prints its HomeKit or Matter setup code, what to do when the sticker is lost, how to type a code in when the QR will not scan, and why a Matter code stops working after the first setup.",
                       url=url, site=SITE, h1="Setup code guides", lede="Where the code is printed, brand by brand, and what still works when it is gone. Each page is checked against the maker's own support pages, with the sources listed.",
                       dateline="")
    head = head.replace('        <p class="crumb"><a href="../guides">Guides</a></p>\n', "").replace('        <p class="fine"></p>\n', "")
    head = head.replace('<link rel="canonical" href="https://smarthomeqr.vishutdhar.com/guides">', '<link rel="canonical" href="https://smarthomeqr.vishutdhar.com/guides">')
    topics = [p for p in pages if p.get("kind") == "topic"]
    brands = [p for p in pages if p.get("kind") == "brand"]
    out = [head]
    for heading, group, sid in (("The problem pages", topics, "topics"), ("Brand by brand", brands, "brands")):
        out.append(f'    <section class="section" id="{sid}" aria-labelledby="{sid}-title">')
        out.append('      <div class="wrap">')
        out.append('        <div class="section-head">')
        out.append(f'          <h2 id="{sid}-title">{heading}</h2>')
        out.append('        </div>')
        out.append('        <dl class="rows">')
        for p in sorted(group, key=lambda p: p.get("order", 0) if p.get("kind") == "topic" else p["short"]):
            out.append('          <div class="row">')
            out.append(f'            <dt class="row-term"><a href="/guides/{esc(p["slug"])}">{esc(p["short"])}</a></dt>')
            out.append(f'            <dd>{esc(p["description"])}</dd>')
            out.append('          </div>')
        out.append('        </dl>')
        out.append('      </div>')
        out.append('    </section>')
        out.append("")
    graph = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "@id": url + "#page", "name": "Setup code guides", "url": url, "isPartOf": {"@id": f"{SITE}/#website"}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "SmartHomeQR", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "Guides", "item": url}]}]}
    out.append(TAIL.format(cta_title="Next time, have the code on your phone",
                           cta_text="SmartHomeQR scans each label once and keeps every HomeKit, Matter and Z Wave code, by home and room, on iPhone, iPad, Apple Watch and Android. Offline, no account. Free for 5 devices.",
                           json_ld=json.dumps(graph, indent=2)))
    return "\n".join(out)


def main():
    OUT.mkdir(exist_ok=True)
    pages = [json.loads(p.read_text()) for p in sorted(DATA.glob("*.json"))]
    for page in pages:
        (OUT / f"{page['slug']}.html").write_text(render(page))
    (OUT / "index.html").write_text(render_index(pages))
    print(f"rendered {len(pages)} guides and the index")


if __name__ == "__main__":
    main()
