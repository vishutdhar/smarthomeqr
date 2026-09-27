#!/usr/bin/env python3
"""Check the privacy policy and the landing page against what the apps send.

Fails if a claim that the PostHog usage and crash reports made false is still
on either page, if a required disclosure is missing, if a page does not parse
cleanly, if an in-page anchor or a local link points nowhere, or if a page
carries dashes or emoji in its prose. With --online it also fetches every
external link and fails on any that does not answer.

Run from anywhere: python3 scripts/check-privacy-policy.py [--online]
"""

import html.parser
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ("privacy.html", "index.html")

# Written into the page text where a block element ends, so a pattern can
# tell the end of a list item from the start of the next one.
BLOCK_END = chr(0xB6)

# Claims that stop being true once the apps send usage events and crash
# reports to PostHog, or that left out something the apps send. Matched,
# ignoring case, after tags are stripped and whitespace collapsed; a compiled
# pattern is used where the old wording is also the start of a true sentence.
FALSE_CLAIMS = {
    "privacy.html": [
        "Last updated: September 1, 2026",
        "runs no analytics of its own",
        "On iOS your data stays on your device and in your private iCloud",
        "What does leave an Android phone is limited to this",
        "We run no analytics of our own",
        "we have no servers there",
        "What can reach us from an iPhone is limited to",
        "what does leave the phone is described under Third-Party Services",
        "Usage analytics or statistics of our own",
        "on Android the identifiers that leave the phone are the per-installation one",
        re.compile(r"Advertising identifiers, or anything that identifies you\s*[.;" + BLOCK_END + "]", re.I),
        "Personal information (name, email, phone number)",
        "diagnostic data about each scan (device model, OS version, app version, a per-installation identifier",
        "Crash reports (unless you choose to share them",
        "does not integrate with any advertising or tracking services",
        "adds no analytics of its own",
        "Beyond those, the external services involved are",
        "records held by Google or Apple (ML Kit diagnostics, Google Play purchase records, crash reports you opted to share) are governed by their policies:",
        "The only data the app stores is the vault a user builds themselves",
    ],
    "index.html": [
        "No analytics of our own",
        "Data Not Collected",
    ],
}

# What the policy has to say now, and what the landing page has to keep.
REQUIRED = {
    "privacy.html": [
        "PostHog",
        "Share anonymous usage and crash reports",
        "More > Privacy",
        "Settings > Privacy",
        "Earlier versions",
        "https://posthog.com/privacy",
        "support@freedom-terminal.com",
    ],
    "index.html": [
        "A Freedom Terminal product",
        "support@freedom-terminal.com",
    ],
}
REQUIRED_IDS = {"privacy.html": ["usage-reports", "earlier-versions"]}

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "source", "track", "wbr"}
# Elements whose end tag HTML lets you leave out.
OPTIONAL_END = {"p", "li", "dt", "dd", "option", "tr", "td", "th"}
# Figure, en, em and horizontal-bar dashes and the minus sign.
DASHES = re.compile("[" + "".join(map(chr, (0x2012, 0x2013, 0x2014, 0x2015, 0x2212))) + "]")
EMOJI = re.compile("[%s-%s%s-%s%s]" % (chr(0x2600), chr(0x27BF), chr(0x1F000), chr(0x1FAFF), chr(0xFE0F)))
BLOCKS = {"p", "li", "h1", "h2", "h3", "h4", "div", "section", "header", "footer"}


class Page(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.errors, self.ids, self.links, self.text = [], [], [], [], []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        for key in ("href", "src"):
            if a.get(key) and a.get("rel") not in ("preconnect", "dns-prefetch"):
                self.links.append(a[key])
        if tag in ("style", "script"):
            self.skip += 1
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag in ("style", "script"):
            self.skip -= 1
        if tag in BLOCKS:
            self.text.append(f" {BLOCK_END} ")
        if tag in VOID:
            self.errors.append(f"line {self.getpos()[0]}: end tag for void <{tag}>")
            return
        while self.stack and self.stack[-1][0] != tag and self.stack[-1][0] in OPTIONAL_END:
            self.stack.pop()
        if not self.stack or self.stack[-1][0] != tag:
            self.errors.append(f"line {self.getpos()[0]}: </{tag}> does not close an open <{tag}>")
            return
        self.stack.pop()

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data)


def normalized(text):
    return re.sub(r"\s+", " ", text).strip()


def check_page(name, online):
    problems = []
    source = (ROOT / name).read_text(encoding="utf-8")
    page = Page()
    page.feed(source)
    page.close()
    problems += [f"{name}: {e}" for e in page.errors]
    problems += [f"{name}: <{t}> opened on line {n} is never closed"
                 for t, n in page.stack if t not in OPTIONAL_END]
    text = normalized(" ".join(page.text))

    for claim in FALSE_CLAIMS.get(name, []):
        if isinstance(claim, str):
            found = claim.lower() in text.lower()
        else:
            found = claim.search(text) is not None
            claim = claim.pattern
        if found:
            problems.append(f"{name}: false claim still present: {claim!r}")
    for phrase in REQUIRED.get(name, []):
        if phrase not in text and phrase not in source:
            problems.append(f"{name}: required disclosure missing: {phrase!r}")
    for anchor in REQUIRED_IDS.get(name, []):
        if anchor not in page.ids:
            problems.append(f"{name}: required id missing: {anchor!r}")
    for dup in sorted({i for i in page.ids if page.ids.count(i) > 1}):
        problems.append(f"{name}: duplicate id {dup!r}")

    for n, line in enumerate(source.splitlines(), 1):
        if DASHES.search(line):
            problems.append(f"{name}:{n}: dash character in prose")
        if EMOJI.search(line):
            problems.append(f"{name}:{n}: emoji in prose")

    for link in sorted(set(page.links)):
        if link.startswith("#"):
            if link != "#" and link[1:] not in page.ids:
                problems.append(f"{name}: in-page link {link} has no matching id")
        elif link.startswith("mailto:"):
            if link != "mailto:support@freedom-terminal.com":
                problems.append(f"{name}: unexpected contact address {link}")
        elif re.match(r"https?://", link):
            if online:
                problems += check_url(name, link)
        else:
            target, _, fragment = link.partition("#")
            if not (ROOT / target).is_file():
                problems.append(f"{name}: local link {link} points to a missing file")
            elif fragment:
                other = Page()
                other.feed((ROOT / target).read_text(encoding="utf-8"))
                if fragment not in other.ids:
                    problems.append(f"{name}: link {link} has no matching id in {target}")
    return problems


def check_url(name, url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (policy link check)"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status >= 400:
                return [f"{name}: {url} answered HTTP {response.status}"]
    except urllib.error.HTTPError as error:
        return [f"{name}: {url} answered HTTP {error.code}"]
    except Exception as error:  # DNS, TLS, timeout
        return [f"{name}: {url} failed: {error}"]
    return []


def main():
    online = "--online" in sys.argv[1:]
    problems = []
    for name in PAGES:
        problems += check_page(name, online)
    for problem in problems:
        print("FAIL", problem)
    print(f"{len(problems)} problem(s) in {', '.join(PAGES)}"
          + (" (links fetched)" if online else " (external links not fetched; pass --online)"))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
