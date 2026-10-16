# SmartHomeQR landing page rebuild: design plan

Date: 2026-10-16. Canonical host: https://smarthomeqr.vishutdhar.com/

## Subject, audience, job

- Subject: an app that saves the setup codes printed on smart home devices (HomeKit, Matter,
  Z Wave, Zigbee, Thread) in a private vault on iPhone, iPad, Apple Watch and Android.
- Audience: people who set up smart homes and then lose the sticker, the box or the manual.
  Many arrive from a search such as "lost HomeKit setup code".
- Job: get the App Store or Google Play tap. Second job: answer the search honestly (where codes
  are printed, and that the app cannot recover a code it never saw).

## Tokens

| Name    | Hex                    | Role |
|---------|------------------------|------|
| ground  | #07080B                | page ground |
| surface | #0F1116, #15181F       | the few raised areas (privacy summary, focus ring backing) |
| ink     | #E6E8EB                | headings |
| body    | #CDD0D4                | body text; #9BA1A8 for fine print only |
| accent  | #A6D0FF "scan blue"    | buttons, links, the scanner corners in the hero |
| paper   | #F5F6F7 with print #0A0B0D | the setup code sticker only |

The accent is the icon's dominant hue. Sampling the icon (white house line excluded) puts 22 percent
of its pixels at hue 220 degrees, average #3778FD. Holding that OKLCH hue (262) and raising lightness
until both brief thresholds pass gives #A6D0FF:
accent text on ground is APCA Lc 75.7 (needs 60), on #15181F Lc 74.7, and ground ink on an accent
button is Lc 76.5 (needs 75). The raw icon blue fails as button ground (Lc 37 with dark ink, 57 with
light ink), so it is not used. Body #CDD0D4 on ground is Lc 77.8; headings Lc 92.7.

## Type

Schibsted Grotesk, 400 and 700, self hosted as two static latin woff2 files (about 23 KB each), cut from
the Google Fonts variable master with fonttools. It was drawn for Schibsted's newspapers: a sturdy,
plain grotesk built to stay legible small, with compact, honest figures and real tabular numerals
(tnum). The page's hero is a row of printed digits, and this audience reads labels, manuals and
model numbers, so a workmanlike news grotesk fits better than a soft geometric. One family for
everything, including the sticker digits.

## Layout

Centred 1120 px column, 8 px rhythm, left aligned text everywhere. Two vertical lines carry the whole
page: the left edge, and the 7fr : 5fr split. Headings and ledes sit in the 7fr column; every row's
description sits in the 5fr column, so the hero media and every row description share one edge.

```
+------------------------------------------------------------------------+
| [icon] SmartHomeQR                                  Pricing  Questions |
|                                                                        |
| Lost a HomeKit or                    .  +--------+   +---------+       |
| Matter setup code?                      | house  |   | iPhone  |       |
|                                         |  2345  |   | Device  |       |
| Look on the device, its box ...         |  6789  |   | Details |       |
| ... $6.99, paid once, no subscription.  | [QR]   |   | 2345-   |       |
|                                         +--------+   | 6789    |       |
| [Download on the App Store] [Google Play]  .         +---------+       |
| iPhone, iPad, Apple Watch and Android.   sticker scans to the App Store |
|------------------------------------------------------------------------|
| Where setup codes are printed (h2 + lede, 7fr)                         |
| HomeKit   482-19-735            | description (5fr)                    |
| Matter    3497-011-2332         | description                          |
| Z Wave    34028-23669-...       | description                          |
|------------------------------------------------------------------------|
| What it does: six rows, term (7fr) and description (5fr)               |
|------------------------------------------------------------------------|
| On every screen you own: three real screenshots, bottoms aligned       |
| iPhone room grid      Apple Watch list       Android device detail     |
|------------------------------------------------------------------------|
| $6.99   Paid once, no subscription.   (price at h1 size)              |
| free tier and Premium in two rows, both store buttons                  |
|------------------------------------------------------------------------|
| Questions: five rows                                                   |
| Footer: support line, Privacy, Support, store badges,                  |
| A Freedom Terminal product, independence note                          |
+------------------------------------------------------------------------+
```

Phone (390 px): one column with 16 px gutters. Headline, lede, buttons, then the sticker and phone
pair at a smaller scale (phone 54 percent of the column width, under 60 percent of the screen). Rows
stack term over description. The gallery becomes a horizontal set of three at smaller heights, or a
stack, whichever keeps every screenshot under 60 percent of the screen width.

## The one memorable element

The hero object is the thing visitors keep losing: a HomeKit style setup code label drawn in SVG at the
real label's proportions (a tall rounded rectangle, width to height 0.74, with a heavy rounded border,
a house mark top left, the eight digits in two rows of four top right, and the QR code filling the
lower part). Details that make it more than a drawing:

- Its digits, 2345 6789, are the same digits the real Device Details screenshot beside it shows saved
  as 2345-6789. The label and its saved copy, side by side, tell the whole product in one look.
- Its QR code is real and scannable: it encodes https://apps.apple.com/app/id6756529233, so a visitor
  on a laptop can point an iPhone camera at the sticker and land on the App Store. A fine print line
  under the pair says so (desktop only, since a phone cannot scan its own screen).
- The house mark is our own drawing in the shape of the SmartHomeQR icon (walls, eaves, chimney), not
  Apple's Home logo, so the label reads as the familiar kind of sticker without copying a trademark.
- The single orchestrated moment: on load, four scan blue viewfinder corners close in around the
  tilted sticker and one scan line passes over it once, the way the app's scanner locks onto a label.
  About one second, CSS only, removed entirely under prefers-reduced-motion.

Everything else is quiet: no other illustration, no accent fills except the primary button, rows and
hairlines instead of cards.

## Review against the generic defaults, and what changed

Checked against: cream plus serif plus terracotta; black plus acid green; broadsheet hairlines
everywhere; the SaaS card kit; template chrome. And against the current page in the repo.

1. The current page is the SaaS kit: gradient wordmark and gradient headline word, an eyebrow with a
   dot over every heading, trust chips, a marquee ticker of fake codes in a mono face, four identical
   rounded screenshot cards, a two tier pricing card pair, brand pills, fade and slide up on every
   section. All of it is gone. Changed to: plain sentence case headings with no eyebrows, rows and
   hairlines, one illustration, one motion moment.
2. First draft put the hero as headline plus a centred phone mockup with a halo, which is the store
   slide look and what every app page does. Changed to: the physical sticker leads and the phone sits
   behind it as the proof, because the sticker is what this audience recognises before any app UI.
3. First draft gave the accent the raw icon blue #3778FD as a big fill. It fails contrast as a button
   and would read as the default "dark plus one bright accent" look. Changed to: the tuned pale scan
   blue, used only on the primary button, links and the scanner corners, well under 5 percent of any
   screen.
4. Hairlines everywhere is the broadsheet default. Changed to: hairlines only between rows of the same
   list, never boxing content, never under the header, and large quiet gaps between sections instead
   of rules.
5. The SEO page used a second label diagram with leader lines. Dropped, because two illustrated labels
   split the boldness; its caption's facts moved into the "What it does" rows.
6. Mono for the sample codes would be the template tell; the codes use the same grotesk with tabular
   figures instead, which is also how the real labels look (a plain sans, not a terminal face).
7. Store buttons in the hero are plain text buttons that say what happens; the official badges appear
   once, in the footer, as the brief asks.

## Content sources and claims

All feature claims come from the fact checked page at freedom-terminal.com/smarthomeqr/ and were
re-checked against the app source on 2026-10-16: free limits 5 devices, 1 home, 3 rooms on both
platforms; Premium removes all three limits on both platforms and gates NFC tag writing on iPhone;
pre 4.0 iPhone buyers are grandfathered; iOS targets iPhone and iPad (device family 1,2) plus watchOS;
Android has widgets, an app lock and JSON backup, and no cloud sync in the current release. Wi Fi
network QR codes are parsed only on Android, so the page does not claim them.
