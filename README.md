# 🎧 SFX Library

A local, fully-static website to **preview, download, tag, and filter** the sound
effects you make for your games. No backend, no database — it runs from plain files
and deploys straight to GitHub Pages.

## How it works

- Drop your sound folders into `sounds/`. Each **top-level folder = a "source game"**.
- Run `node scan.mjs` to (re)build `data/manifest.js` — the index the site reads.
- Open the site. Filter by **game**, **length**, and your own **custom tags**;
  preview inline; download with one click.

## Features

- **Waveform preview** on every card — click anywhere on it to seek.
- **Loudness readout** — peak dBFS and RMS dBFS (perceived loudness) per sound, so you
  can spot clipping (peak near 0 dB shows red/amber) and normalize across your library.
- **Favorites** — star sounds and filter to "Favorites only".
- **Custom tags** with an in-app editor and reusable autocomplete.
- **Bulk tagging** — select multiple sounds and add/remove a tag or star them all at once.
- **Sorting** — by name, duration, loudness (peak), file size, or game.
- **Search** by name, plus AND/OR tag matching.

Loudness and waveform data are computed instantly for WAV files during `node scan.mjs`.
For compressed formats (mp3/ogg/…) they're measured in the browser on first view and cached
(this needs the site to be *served*, not opened via `file://` — see below).

## Adding sounds

1. Paste a folder of sounds into `sounds/`, e.g.:
   ```
   sounds/
     Skyrim/
       sword_swing_01.wav
       menu_select.wav
     MyPlatformer/
       jump.ogg
       coin.wav
   ```
2. From the project root, run:
   ```
   node scan.mjs
   ```
3. Refresh the page. New sounds appear, auto-tagged with their game and a length bucket.

Supported: `wav, mp3, ogg, oga, m4a, aac, flac, opus, weba, webm`.
WAV durations are read instantly from the file header; other formats are measured in
the browser the first time you view them (and cached).

## Previewing locally

Either option works:

- **Quick:** just open `index.html` in your browser (the manifest loads even over `file://`).
- **Server (recommended, matches GitHub Pages):**
  ```
  node serve.mjs          # http://localhost:8080
  ```
  Or `npm start` to scan **and** serve in one step.

## Tagging

Beyond the automatic `game` and `length` tags, you can add your own reusable tags:

- Click **+** on any sound card, type a tag, press Enter. Reuse tags via autocomplete.
- Tags (and favorites) are saved in your browser (`localStorage`) as you work.
- Filter by tags in the sidebar. Toggle **match all** for AND-style filtering
  (a sound must have *every* selected tag) vs. the default OR.
- Use the **bulk bar** (appears when you tick sound checkboxes) to tag/star many at once.

### Making tags + favorites permanent (for GitHub Pages)

`localStorage` lives only in your browser. To ship your tags and favorites with the site:

1. Click **Export** — downloads `library-data.json` (contains `tags` and `favorites`).
2. Move that file to `data/library-data.json` in the project and commit it.

When the site is served (e.g. on Pages), it loads `data/library-data.json` automatically as
the starting point. **Import** lets you load a `library-data.json` back into a browser that
doesn't have it yet (handy on another machine, or over `file://`).

## Deploying to GitHub Pages

1. Run `node scan.mjs` so `data/manifest.js` is current, and export/commit `data/library-data.json`.
2. Commit everything **including the `sounds/` folder** (the audio files are served directly).
3. Push to GitHub, then enable Pages: repo **Settings → Pages → Deploy from branch**,
   pick your branch and the root (`/`). Done.

> Note: GitHub repos have size limits (soft ~1 GB, and a 100 MB per-file cap). Large
> `.wav` libraries can get big — converting to `.ogg`/`.mp3` shrinks them a lot if needed.

## Project layout

```
index.html          the app shell
css/style.css       styling
js/app.js               all UI logic (waveform, loudness, tags, favorites, bulk, sort, filter)
scan.mjs                scans sounds/ -> data/manifest.js   (run after adding sounds)
serve.mjs               tiny zero-dependency local static server
data/manifest.js        AUTO-GENERATED index incl. duration/loudness/waveform (don't edit)
data/library-data.json  your exported tags + favorites (optional, commit to publish)
sounds/                 your game folders go here
```

## Removing the demo

This project ships with a `sounds/Demo/` folder of placeholder tones so it works out of
the box. Delete that folder and re-run `node scan.mjs` whenever you're ready.
