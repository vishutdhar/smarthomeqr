#!/usr/bin/env python3
"""Check the asset naming rule that vercel.json relies on.

vercel.json caches a file under images/ or fonts/ for a year, as immutable, only when its name
carries the first 8 hex digits of its SHA-256 (name.1a2b3c4d.ext). That is safe only while
1. every such name matches its content, and
2. every image or font the pages use has such a name and exists.
To make sure no misspelt reference slips past the second check, every same-site reference the pages
make, page links included, must resolve to a file the way the site serves it (clean URLs, so
/privacy is privacy.html and / is index.html).

References are read the way a browser reads them: HTML attributes through the standard HTML
parser, srcset with the HTML candidate rules, JSON-LD as JSON, and CSS url() values with CSS escapes
decoded. Each one is resolved with the standard URL resolver against the page's address on the site,
or its <base href> when it has one, and compared by origin.
Changed an image? Rename it with the new hash (shasum -a 256 FILE | cut -c1-8) and update the
references, then run: python3 tools/check-asset-names.py
"""
import hashlib
import json
import os
import posixpath
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "privacy.html", "style.css", "tools/og.html"]
SITE = "https://smarthomeqr.vishutdhar.com/"
HOST = urlsplit(SITE).hostname
HASHED = re.compile(r"^.+\.([0-9a-f]{8})\.[a-z0-9]+$")
CSS_URL = re.compile(r"url\(\s*(?:\"([^\"]*)\"|'([^']*)'|([^)\s]*))\s*\)", re.IGNORECASE)
CSS_ESCAPE = re.compile(r"\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|(.))", re.DOTALL)
URL_ATTRS = {"src", "href", "poster", "data"}


def css_unescape(value):
    return CSS_ESCAPE.sub(lambda m: chr(int(m.group(1), 16)) if m.group(1) else m.group(2), value)


def css_urls(text):
    for match in CSS_URL.finditer(text):
        yield css_unescape(next(group for group in match.groups() if group is not None))


def srcset_urls(value):
    """The URLs of a srcset, following the HTML candidate parsing rules."""
    pos, size, urls = 0, len(value), []
    while True:
        while pos < size and (value[pos] in " \t\n\r\f,"):
            pos += 1
        if pos >= size:
            return urls
        start = pos
        while pos < size and value[pos] not in " \t\n\r\f":
            pos += 1
        url = value[start:pos]
        if url.endswith(","):
            urls.append(url.rstrip(","))
            continue
        urls.append(url)
        depth = 0
        while pos < size:
            char = value[pos]
            pos += 1
            if char == "(":
                depth += 1
            elif char == ")":
                depth = max(0, depth - 1)
            elif char == "," and depth == 0:
                break


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
        self.base = None
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
                self.urls.extend(srcset_urls(value))
            elif name == "style":
                self.urls.extend(css_urls(value))
        if tag == "base" and self.base is None and attrs.get("href") is not None:
            self.base = attrs["href"].strip()
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
            self.urls.extend(s for s in json_strings(json.loads(text)) if re.match(r"^(https?:)?/", s))
        else:
            self.urls.extend(css_urls(text))
        self.raw = self.raw_kind = None


def references(page):
    text = (ROOT / page).read_text(encoding="utf-8")
    base = urljoin(SITE, page)
    if page.endswith(".css"):
        found = list(css_urls(text))
    else:
        collector = Collector()
        collector.feed(text)
        collector.close()
        found = collector.urls
        if collector.base is not None:
            base = urljoin(base, collector.base)
    for ref in found:
        url = urlsplit(urljoin(base, ref))
        default_port = {"http": 80, "https": 443}.get(url.scheme)
        if default_port is None or url.hostname != HOST or url.port not in (None, default_port):
            continue
        yield unquote(url.path).lstrip("/")


def exists_exactly(path):
    """True when the file exists with exactly this spelling. Vercel serves from a case sensitive
    file system, so a name that only matches on a case insensitive Mac would be a 404 there."""
    folder = ROOT
    for part in path.split("/"):
        if not folder.is_dir() or part not in os.listdir(folder):
            return False
        folder = folder / part
    return folder.is_file()


def served_file(path):
    """The file the site serves for a path, with clean URLs, or None when there is none."""
    if path == "" or path.endswith("/"):
        candidates = [path + "index.html"]
    else:
        candidates = [path, path + ".html"]
    return next((c for c in candidates if exists_exactly(c)), None)


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
            target = served_file(path)
            if target is None:
                problems.append(f"{page}: missing file {path or '/'}")
            # An asset is anything that names an images or fonts folder, in any capitalisation,
            # or lands in one; each must sit in the real folder and carry a content hash.
            asset = re.search(r"(^|/)(images|fonts)/", path, re.IGNORECASE) or (
                target is not None and re.match(r"^(images|fonts)/", target))
            if not asset:
                continue
            if not (path.startswith("images/") or path.startswith("fonts/")):
                problems.append(f"{page}: {path} is outside images/ and fonts/")
            elif not HASHED.match(posixpath.basename(path)):
                problems.append(f"{page}: unhashed reference {path}")
    for problem in problems:
        print(problem)
    if not problems:
        print("asset names ok")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
