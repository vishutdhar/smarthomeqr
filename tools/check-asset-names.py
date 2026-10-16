#!/usr/bin/env python3
"""Check the asset naming rule that vercel.json relies on.

vercel.json caches a file under images/ or fonts/ for a year, as immutable, only when its name
carries the first 8 hex digits of its SHA-256 (name.1a2b3c4d.ext). That is safe only while
1. every such name matches its content, and
2. every image or font the pages use has such a name and exists.

References are read the way a browser reads them: HTML attributes through the standard HTML
parser (only srcset is split into candidates), JSON-LD as JSON, and CSS url() values, then each one
is resolved with the standard URL resolver against the page's own address on the site.
Changed an image? Rename it with the new hash (shasum -a 256 FILE | cut -c1-8) and update the
references, then run: python3 tools/check-asset-names.py
"""
import hashlib
import json
import posixpath
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "privacy.html", "style.css", "tools/og.html"]
SITE = "https://smarthomeqr.vishutdhar.com/"
HOST = urlsplit(SITE).netloc
HASHED = re.compile(r"^.+\.([0-9a-f]{8})\.[a-z0-9]+$")
CSS_URL = re.compile(r"url\(\s*(?:\"([^\"]*)\"|'([^']*)'|([^)\s]*))\s*\)")
URL_ATTRS = {"src", "href", "poster", "data"}


def css_urls(text):
    for match in CSS_URL.finditer(text):
        yield next(group for group in match.groups() if group is not None)


def json_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from json_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from json_strings(item)


class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.urls = []
        self.raw = None
        self.raw_kind = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name, value in attrs.items():
            if value is None:
                continue
            if name in URL_ATTRS:
                self.urls.append(value.strip())
            elif name in ("srcset", "imagesrcset"):
                for candidate in value.split(","):
                    tokens = candidate.split()
                    if tokens:
                        self.urls.append(tokens[0])
            elif name == "style":
                self.urls.extend(css_urls(value))
        if tag == "meta" and "content" in attrs:
            key = (attrs.get("property") or attrs.get("name") or "").lower()
            if key.endswith(":image") or key.endswith("image"):
                self.urls.append((attrs["content"] or "").strip())
        if tag == "script" and (attrs.get("type") or "").lower() == "application/ld+json":
            self.raw, self.raw_kind = [], "json"
        elif tag == "style":
            self.raw, self.raw_kind = [], "css"

    def handle_data(self, data):
        if self.raw is not None:
            self.raw.append(data)

    def handle_endtag(self, tag):
        if self.raw is None or tag not in ("script", "style"):
            return
        text = "".join(self.raw)
        if self.raw_kind == "json":
            self.urls.extend(s for s in json_strings(json.loads(text)) if "/" in s)
        else:
            self.urls.extend(css_urls(text))
        self.raw = self.raw_kind = None


def references(page):
    text = (ROOT / page).read_text(encoding="utf-8")
    if page.endswith(".css"):
        found = list(css_urls(text))
    else:
        collector = Collector()
        collector.feed(text)
        collector.close()
        found = collector.urls
    base = urljoin(SITE, page)
    for ref in found:
        url = urlsplit(urljoin(base, ref))
        if url.scheme not in ("http", "https") or url.netloc != HOST:
            continue
        path = unquote(url.path).lstrip("/")
        if re.search(r"(^|/)(images|fonts)/", path):
            yield path


def main():
    problems = []
    for folder in ("images", "fonts"):
        for file in sorted((ROOT / folder).iterdir()):
            match = HASHED.match(file.name)
            if not match:
                continue
            actual = hashlib.sha256(file.read_bytes()).hexdigest()[:8]
            if match.group(1) != actual:
                problems.append(f"stale name: {folder}/{file.name} holds content {actual}")
    for page in PAGES:
        for path in sorted(set(references(page))):
            if not (path.startswith("images/") or path.startswith("fonts/")):
                problems.append(f"{page}: {path} is outside images/ and fonts/")
            elif not HASHED.match(posixpath.basename(path)):
                problems.append(f"{page}: unhashed reference {path}")
            if not (ROOT / path).is_file():
                problems.append(f"{page}: missing file {path}")
    for problem in problems:
        print(problem)
    if not problems:
        print("asset names ok")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
