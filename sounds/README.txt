Paste your sound-effect folders here.

Each TOP-LEVEL folder in this directory becomes a "source game" tag.

Example:
  sounds/
    Skyrim/
      sword_swing_01.wav
      menu_select.wav
    MyPlatformer/
      jump.ogg
      coin.wav

After adding or changing folders, run this from the project root:
  node scan.mjs

That regenerates data/manifest.js, which the website reads. Then refresh the page.

Supported formats: wav, mp3, ogg, oga, m4a, aac, flac, opus, weba, webm
(WAV durations are computed instantly; other formats are measured in the browser on first view.)
