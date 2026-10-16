#!/usr/bin/env python3
"""Check the asset naming rule that vercel.json relies on.

vercel.json caches a file under images/ or fonts/ for a year, as immutable, only when its name
carries the first 8 hex digits of its SHA-256 (name.1a2b3c4d.ext). That is safe only while
1. every such name matches its content, and
2. every image or font the pages use has such a name and exists.

References are read from quoted attribute and JSON values and from CSS url(), never from prose,
and each one is resolved against the folder of the file that holds it, the way a browser would.
Changed an image? Rename it with the new hash (shasum -a 256 FILE | cut -c1-8) and update the
references, then run: python3 tools/check-asset-names.py
"""
import hashlib
import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "privacy.html", "style.css", "tools/og.html"]
SITE = "https://smarthomeqr.vishutdhar.com/"
HASHED = re.compile(r"^.+\.([0-9a-f]{8})\.[a-z0-9]+$")
# Quoted values ("..." or '...') and CSS url(...) values.
VALUES = re.compile(r'"([^"\n]*)"|\'([^\'\n]*)\'|url\(\s*([^)\'"\s]+)\s*\)')


def references(page):
    text = (ROOT / page).read_text(encoding="utf-8")
    base = posixpath.dirname(page)
    for match in VALUES.finditer(text):
        value = next(group for group in match.groups() if group is not None)
        # A srcset is a comma separated list of "url width" pairs; anything else yields one token.
        for part in value.split(","):
            tokens = part.split()
            if not tokens:
                continue
            url = re.split(r"[?#]", tokens[0], maxsplit=1)[0]
            if url.startswith(SITE):
                path = url[len(SITE):]
            elif re.match(r"^[a-z][a-z0-9+.-]*:", url) or url.startswith("//"):
                continue
            elif url.startswith("/"):
                path = url.lstrip("/")
            else:
                path = posixpath.normpath(posixpath.join(base, url))
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
