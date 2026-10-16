# SmartHomeQR landing page, pass 2: the app's colours, depth and motion

Date: 2026-10-16. Owner, after seeing the rebuilt page live: "can we match the colors of the app in
the landing page and add some 3d stuff to them? also some animations?"

This pass changes three things on the page merged in #8. Everything the first design plan
(2026-10-16-landing-rebuild-design.md) settled still holds: the content, the structure, the type
scale, rows and hairlines instead of cards, one typeface, the sticker as the hero object, the
hashed asset scheme and the privacy page.

## 1. The palette, sampled from the app

### Which appearance the app has

Neither "dark only" nor "follows the system". Both apps force one appearance from their own
setting, and the setting starts on dark:

- iOS: `HomeQRApp.swift` applies `.preferredColorScheme(darkModeEnabled ? .dark : .light)`, with
  `@AppStorage("darkModeEnabled") ... = true`. More, Appearance, Dark Mode switches it to light.
- Android (the live app, `HomeQR/android/SmartHomeQR`): `MainActivity.kt` reads the `dark_mode`
  preference with `?: true`, and Settings switches it.
- Every store screenshot and every screenshot on this page is the dark appearance.

The app supports both appearances, so the page carries full token sets for both and follows
`prefers-color-scheme`, as the brief asks. Dark is the base set because it is the app's default;
light is the override.

### Sampled values and where each came from

| Token | Dark | Light | Source |
|---|---|---|---|
| ground | #000000 | #F2F2F7 | iOS `systemGroupedBackground`. Dark sampled from the store screenshots (Homes list and More, empty area) and the Device Details screenshot on this page; both read exactly #000000. |
| surface | #1C1C1E | #FFFFFF | iOS `secondarySystemGroupedBackground`, the grouped list cards. Dark sampled from the Homes list card: exactly #1C1C1E. |
| surface 2 | #2C2C2E | #E5E5EA | iOS `tertiarySystemGroupedBackground` / `systemGray5`, the device edge in the hero. |
| heading ink | #FFFFFF | #000000 | iOS `label`. |
| body ink | #D1D1D6 | #3C3C43 | Neutrals from the iOS gray ramp (`systemGray4` light; the opaque base of `secondaryLabel`), chosen to pass Lc 75. The app's own `secondaryLabel` is 60 percent alpha and too faint for paragraphs. |
| fine print | #C7C7CC | #636366 | iOS `systemGray3` light / `systemGray2` dark, fine print only. |
| hairline | rgba(84,84,88,0.65) | rgba(60,60,67,0.29) | iOS `separator`, exactly. |
| accent (app tint) | #007AFF | #007AFF | `Assets.xcassets/AccentColor` is sRGB 0, 0.478, 1 (universal, no dark variant). The More screen's link rows sample exactly #007AFF. |
| button fill | #0072F0 | #0072F0 | The app's tint held at its OKLCH hue (257.4) and darkened the least amount that lets white button text pass Lc 75. |
| link text | #74BAFF | #0072F0 | Same hue. Dark: raised in lightness until it passes Lc 60 on both #000000 and #1C1C1E. Light: the button blue, which passes Lc 60 on #F2F2F7. |
| status (second colour) | #30D158 | #248A3D | iOS `systemGreen`. The app uses it for its scan states: the viewfinder frame turns green when it locks on and captures (`ViewfinderOverlay`, `SmartCameraView.swift`), and "QR found" and the found setup code are green in the scan review. Dark sampled from the Face ID and Dark Mode switches: exactly #30D158. Light uses the increased contrast variant, because #34C759 is too faint as a thin line on #F2F2F7. |
| label paper and print | #F5F6F7, #0A0B0D | same | The physical sticker keeps its own colours in both schemes. |

Other blues seen in the app and not used: the category icon tiles and the Device Details bulb tile
are `Color.blue` (#0091FF in dark on iOS 26 and later), and the selected tab is the glass blend
#1D97FF. Android's Material primary is indigo #6366F1, a separate scheme the iPhone app does not
share; the page follows the iPhone app, which every store screenshot shows.

### Contrast, APCA

| Pair | Lc | Bar |
|---|---|---|
| #FFFFFF heading on #000000 | 107.9 | 90 |
| #D1D1D6 body on #000000 / on #1C1C1E | 78.9 / 77.3 | 75 |
| #74BAFF link on #000000 / on #1C1C1E | 62.4 / 60.8 | 60 |
| #FFFFFF on #0072F0 button | 75.8 | 75 |
| #000000 heading on #F2F2F7 | 98.5 | 90 |
| #3C3C43 body on #F2F2F7 / on #FFFFFF | 87.8 / 95.4 | 75 |
| #0072F0 link on #F2F2F7 | 62.8 | 60 |
| #C7C7CC fine on #000000; #636366 fine on #F2F2F7 | 72.9; 72.4 | none set |

The app's own #007AFF fails both bars here (white text on it is Lc 72.0; as text on black it is
Lc 35.1), which is why the two tuned blues exist.

### Coverage

Two chromatic colours. The blue is on the two primary buttons, the links and the focus ring. The
green appears in one place: the viewfinder corners in the hero, and only once the label has
settled flat and the frame locks, the same moment the app's frame turns green. Neither colour is
used on a background or a band.

## 2. Depth: one scene, CSS 3D only

No WebGL, no libraries, no generated images. The scene is plain elements in a `perspective`
container with `transform-style: preserve-3d`.

### The planes, back to front

1. Background plane: a quiet field of saved codes, drawn as the app's All Devices list: a grouped
   list cards with rows of QR thumbnails, name and maker lines and chevrons, at low contrast. It sits
   deepest (translateZ -170 px), shows above and to the right of the device, and fades out downward.
2. Subject plane: the real Device Details screenshot (Living Room Lights, setup code 2345-6789),
   in the middle depth.
3. Foreground: the device and its label. The device is a plain rounded slab with real thickness
   (a face and an edge layer 14 px behind it), the underside of a hub. The setup code label sits on
   it. The slab overlaps the screenshot's lower right, so the screen reads as behind it.

Shared contact point: the label's bottom strip is stuck to the device, and the whole rig pivots
about that strip. Tilting the scene swings every plane around the one point where the label
touches the device, so the planes stay one scene.

### The one 3D treatment: the label peels off and settles flat

The label is split along a fold line just below its QR code. The bottom strip stays flat on the
device. The rest of the label, house mark, digits and the whole QR code, is one rigid sheet
hinged on that fold and lifted toward the viewer by 42 degrees, the pose of a label that has come
unstuck. Beneath it the device shows the label's footprint, and the lifted sheet casts a
blurred shadow onto the device that leans away from a light at the upper left, wider at the top
than at the hinge.

As the page scrolls through the hero, the sheet rotates down onto its footprint, the shadow
shortens into a contact shadow, and the rig turns from its three quarter pose (turned 12 degrees,
tipped back 5) to face the reader.
When the label is flat the viewfinder corners around the footprint turn green, the app's capture
colour. On a desktop pointer the rig also tilts up to 6 degrees toward the pointer, smoothed every
frame; on touch the scroll alone drives it.

The QR code is never bent: the fold is below it, so at every scroll position it is one flat plane
in perspective, and it is checked by decoding screenshots at rest.

Shadows: the screenshot and the device cast offset, blurred shadows downward and to the right, the
same light as the label's shadow. On the black ground those read only where they fall on the device
face; on the light ground they read everywhere.

## 3. Motion score

| Section | Moment | Trigger | What moves | Duration |
|---|---|---|---|---|
| Hero | Planes settle | page load, CSS only | background field fades in and drifts down 18 px; the screenshot rises 24 px; the device slides in 32 px from the right; the label drops from an 82 degree lift to its resting 42 | 0 to 1100 ms, 80 ms apart |
| Hero | Viewfinder closes | page load, after the label lands | corners scale in from 1.08 and fade in, around the footprint | 640 to 1160 ms |
| Hero | Copy arrives | page load, after the planes | headline rises 10 px (visible from the first frame); lede, buttons and fine print fade in and rise 8 px | 120 to 1000 ms, staggered |
| Hero | Label settles flat | scroll through the hero | label lift 42 degrees to 0; rig turns from 12 and 5 degrees to 0; the field drifts down 28 px, the screen 6 px, the device up 18 px; corners turn green when flat | tied to scroll: from the moment the whole scene is in view, over 60 percent of its height or 40 percent of the viewport, whichever is less |
| Hero | Pointer tilt | pointer, fine pointers only | the rig, up to 6 degrees each way | lerped each frame |
| Where codes are printed | Codes print | the list enters the viewport, once | each sample code wipes in left to right like a label printer (clip-path) | 560 ms, 120 ms apart |
| What it does | Rows along their hairline | the list enters, once | each hairline draws from the left (scaleX), then the row text fades in | 520 ms, 70 ms apart |
| Platforms | Screens straighten | the gallery enters, once | each screenshot turns from perspective (rotateY -18, rotateX 6, pushed back 40 px) to flat | 760 ms, 110 ms apart |
| Pricing | The price arrives | the price enters, once | $6.99 rises out of its own line box; the terms fade in after | 620 ms, terms at 180 ms |
| Questions, footer | none | | the page ends quiet | |
| Buttons | hover, press | pointer | rise 1 px on hover, scale 0.98 on press | 120 ms |

Rules the build follows: transform, opacity and clip-path only (the one exception is the cast
shadow's fixed blur, which is set once and never animated); no `transition: all`; no pinned
sections; no scroll cue; no counters; no full viewport overlays. Reveals use one
IntersectionObserver that adds a one time class the moment a list's first pixel enters the viewport,
so no list on screen ever sits in its hidden start state. The scroll and pointer work runs in one
requestAnimationFrame loop with passive listeners; the only geometry read is the scene's position,
measured on load and resize, never per frame. The loop stops when the hero is out of view and when
the pointer has settled. Links do not animate.

Without JavaScript nothing is hidden: the hidden start states of the reveals apply only under a
class the script adds. The script is inline at the end of the page (1.9 KB minified), so the class
is in place before the first paint and no list flashes visible and then hidden.

## 4. Reduced motion

Under `prefers-reduced-motion: reduce` no animation, transition or script motion runs: the load
keyframes sit inside a `no-preference` query, the script exits before adding its class, and every
section is in its final state. The hero keeps its depth: the scene renders at its resting pose,
label lifted, rig in three quarter view, shadows and occlusion intact, as a still.

The preference is followed live. If a reader turns reduced motion on after the page has loaded, the
CSS start states and transitions drop out on their own (they sit in the no-preference query), and the
script cancels its frame loop and clears the scene's scroll and pointer values, so the hero returns
to that resting still and no longer answers scroll or pointer. Turned off again, the scroll drives it
once more.

## 5. Review against the generic defaults

- Near black with one bright accent: the ground is true #000000 because that is the app's
  ground, not a tinted near black. The accent is the app's own blue, not acid green.
- The SaaS card kit: the device slab is the one rounded shape that carries a shadow, and it is a
  physical object in a 3D scene, not a content card. Sections stay rows and hairlines.
- Fade and slide up on every section: each reveal is a different verb tied to its content
  (print, draw, straighten, arrive), and the last section has none.
- Hover on everything: only the buttons answer; links stay still.
- Gradient text, neon, zero offset glows: none. Every shadow has an offset and a blur and sits on
  the surface under the thing that casts it.

## 6. Critique notes from the screenshot passes

1. First build lifted the label 24 degrees. Seen nearly head on, a sheet hinged at its foot only
   grows as it comes toward the viewer, so it hid its own footprint and read as a card floating in
   front of a tray. At 42 degrees the top edge drops under perspective and uncovers the footprint,
   the viewfinder's top corners and the cast shadow, which is what makes it read as peeling.
2. The resting pose was tuned from the pointer extremes: the bottom left pointer pose (turned 14,
   tipped 2) showed the peel best, so rest moved to turned 12, tipped 5.
3. The background list sat behind the screen, where only its bars showed. Its QR thumbnails are what
   say "saved codes", so it moved right until the thumbnails peek out above the device, then narrowed
   until its right edge sits on the column edge at every width from 320 to 1920.
4. On the dark ground the footprint was darker than the device face, so the shadow had nothing to
   darken. The footprint is now a shade lighter than the face (adhesive residue), and the shadow
   reads on it.
5. The device's drop shadow smudged the background list in the light scheme; it is shorter and
   lighter.
6. The reveals first waited until a list was 10 percent into the viewport. In the iPhone simulator a
   reader stopped with the HomeKit row at the bottom of the screen saw the term with an empty gap
   where its code prints. Reveals now start on the first visible pixel.
7. iOS Safari linked the sample code 482-19-735 as a phone number (blue, underlined, dialling).
   Telephone detection is off for the page.
8. The privacy page had two raw ">" characters that failed validation; they are entities now and
   render the same text.

## 7. Verification notes

- Chromium and Firefox render the scene identically. Playwright's WebKit build on this Mac paints
  even a minimal perspective test flat, so it cannot judge 3D; the real check was Mobile Safari in an
  iOS 27 simulator, which renders the lifted label in true perspective, the flat locked state, and
  both colour schemes.
- The QR code decodes to https://apps.apple.com/app/id6756529233 from screenshots of the label at
  rest (42 degree lift) and flat, at 1440 and 390, in both schemes.
- The social card (images/og.fa189b3f.png) is the same composition in the new dark tokens with the
  viewfinder locked green. The previous card file stays so links already shared keep their preview.
