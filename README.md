# Make your UBC badge

A one-page site where students click the photo area on the badge, drop in their
picture, and download a share-ready University Blockchain Conference graphic.

Everything runs in the browser on a `<canvas>` — no backend, and the photo never
leaves the student's device.

## Run it locally

From this folder:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173

## How it works for a student

1. Click the white square on the badge (or drag a file onto the badge) → photo picker opens.
2. Drag on the photo to reposition, zoom slider to scale, **Recenter** / **Change photo** to redo.
3. Name and university/club fields appear once a photo is in — both optional.
4. **Banner** (1600×900, for X/Twitter and LinkedIn) or **Story** (1080×1920).
5. Headline: *I'm attending* or *I'm a speaker*.
6. **Download PNG** → `<name>-ubc-2026-<format>.png`.
7. **Share on X / LinkedIn** — see below.

## About the share buttons

No website can attach an image to a post on X or LinkedIn — both only accept
text and a link through their share URLs, and the image has to be added by the
person posting. So the buttons do the next best thing, in one click:

1. open the composer with the caption and conference link already filled in,
2. download the badge PNG,
3. copy the caption to the clipboard as a backup.

The student just drags the downloaded image into the post. The caption switches
between "I'm attending" and "I'm speaking at" to match the headline.

On browsers that support sharing files (iOS/Android, Safari), a third **Share**
button appears and hands the actual PNG to the system share sheet — that one
does attach the image. It stays hidden elsewhere.

## Files

| file | what it holds |
| --- | --- |
| `index.html` | page structure |
| `styles.css` | site styling (navy `#2a3a45` / orange `#e9873d`) |
| `app.js` | canvas renderer, both layouts, upload + pan/zoom + export |
| `assets/logo-lockup-dark.png` | **in use** — orange mark with white centre beads, orange *UNIVERSITY*, white *BLOCKCHAIN CONFERENCE* |
| `assets/logo-lockup-badge.png` | the inverse — white mark with orange centre beads, all-white wordmark |
| `assets/logo-lockup-color.png` | official brand colours, for light backgrounds |
| `assets/logo-lockup-white.png` | all-white mono lockup |
| `assets/logo-mark-white.png` | icon only, white |
| `assets/college-xyz-logo.png` | College.xyz partner lockup, shown beside the conference logo |

The logo assets are extracted straight from `MBC_Logos_2026.ai` (page 2, the long
lockup) at 2400 px wide, so they stay sharp at any export size. To switch the
badge to the white-mark version, change the `logo.src` line at the top of
`app.js` to `assets/logo-lockup-badge.png`.

## Using your own badge artwork

The background is currently drawn in code. To use your own exported artwork
instead, export it as a PNG with the photo area left empty, save it into
`assets/`, and fill in `TEMPLATES` at the top of `app.js`:

```js
const TEMPLATES = {
  banner: { src: 'assets/template-banner.png', w: 1600, h: 900,
            frame:  { x: 980, y: 210, w: 480, h: 480 },
            credit: { x: 96, y: 676, size: 36, align: 'left' } },
  story: null,
};
```

`frame` is where the photo goes in the artwork's own pixel coordinates, and
`credit` is where the optional name/club lines print. With a template set, the
app draws only the photo and those two lines on top of your artwork — the
headline switch stops applying, since the headline is baked into the file.
