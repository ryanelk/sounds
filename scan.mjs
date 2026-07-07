// scan.mjs — scans the /sounds folder and generates data/manifest.js
//
// Usage:  node scan.mjs
//
// Convention: each TOP-LEVEL folder inside /sounds is treated as a "source game".
//   sounds/Skyrim/sword_01.wav   ->  game: "Skyrim"
//   sounds/Zelda/UI/menu.wav     ->  game: "Zelda"  (deeper folders are ignored for the game tag)
//   sounds/loose_sound.wav       ->  game: "Uncategorized"
//
// Output is written as a JS global (window.__SFX_MANIFEST__) rather than plain JSON
// so the site also works when opened directly from disk (file://) without a server.

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, extname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOUND_DIR = join(__dirname, 'sounds');
const OUTPUT = join(__dirname, 'data', 'manifest.js');

// Audio extensions browsers can generally play with <audio>.
const AUDIO_EXTS = new Set([
  '.wav', '.mp3', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.opus', '.weba', '.webm',
]);

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip hidden files/dirs
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (AUDIO_EXTS.has(extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

const WAVEFORM_BINS = 160; // number of peak samples drawn per waveform

// Returns a function that reads one normalized (-1..1) sample at a byte offset,
// based on the WAV format tag and bit depth. Returns null for unsupported formats.
function makeSampleReader(buf, audioFormat, bits) {
  if (audioFormat === 3 && bits === 32) return (p) => buf.readFloatLE(p);
  if (audioFormat === 3 && bits === 64) return (p) => buf.readDoubleLE(p);
  if (audioFormat === 1 || audioFormat === 0xfffe) {
    if (bits === 8) return (p) => (buf.readUInt8(p) - 128) / 128;        // 8-bit is unsigned
    if (bits === 16) return (p) => buf.readInt16LE(p) / 32768;
    if (bits === 24) return (p) => {
      let v = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16);
      if (v & 0x800000) v -= 0x1000000;                                  // sign-extend
      return v / 8388608;
    };
    if (bits === 32) return (p) => buf.readInt32LE(p) / 2147483648;
  }
  return null;
}

// Full WAV analysis: duration, peak/RMS loudness (dBFS), and a normalized waveform.
// Compressed formats (mp3/ogg/…) return null and are analyzed in the browser instead.
function analyzeWav(filePath) {
  let buf;
  try { buf = readFileSync(filePath); } catch { return null; }
  if (buf.length < 44) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;

  let offset = 12, fmt = null, dataOff = -1, dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(offset + 8),
        channels: buf.readUInt16LE(offset + 10),
        sampleRate: buf.readUInt32LE(offset + 12),
        byteRate: buf.readUInt32LE(offset + 16),
        bits: buf.readUInt16LE(offset + 22),
      };
    } else if (id === 'data') {
      dataOff = offset + 8;
      dataSize = Math.min(size, buf.length - dataOff);
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (!fmt || dataOff < 0) return null;

  const bytesPerSample = fmt.bits / 8;
  const frameSize = bytesPerSample * fmt.channels;
  if (frameSize <= 0) return null;
  const read = makeSampleReader(buf, fmt.audioFormat, fmt.bits);
  const totalFrames = Math.floor(dataSize / frameSize);
  const duration = fmt.byteRate > 0 ? dataSize / fmt.byteRate : totalFrames / (fmt.sampleRate || 1);

  const result = { duration: round(duration, 3), peakDb: null, rmsDb: null, peaks: null };
  if (!read || totalFrames === 0) return result;

  const peaks = new Array(WAVEFORM_BINS).fill(0);
  let globalPeak = 0, sumSq = 0, count = 0;
  for (let f = 0; f < totalFrames; f++) {
    const bin = Math.min(WAVEFORM_BINS - 1, Math.floor((f * WAVEFORM_BINS) / totalFrames));
    const base = dataOff + f * frameSize;
    let frameMax = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const v = read(base + c * bytesPerSample);
      const a = Math.abs(v);
      if (a > frameMax) frameMax = a;
      if (a > globalPeak) globalPeak = a;
      sumSq += v * v;
      count++;
    }
    if (frameMax > peaks[bin]) peaks[bin] = frameMax;
  }
  const rms = count ? Math.sqrt(sumSq / count) : 0;
  result.peakDb = toDb(globalPeak);
  result.rmsDb = toDb(rms);
  result.peaks = peaks.map((p) => round(p, 3));
  return result;
}

function toDb(amp) { return amp > 0 ? round(20 * Math.log10(amp), 1) : null; }
function round(n, d) { const f = 10 ** d; return Math.round(n * f) / f; }

function toUrl(p) {
  // Build a forward-slash URL relative to the site root, regardless of OS separators.
  return relative(__dirname, p).split(sep).join('/');
}

function main() {
  const files = walk(SOUND_DIR).sort((a, b) => a.localeCompare(b));
  const sounds = files.map((full) => {
    const relToSounds = relative(SOUND_DIR, full).split(sep).join('/');
    const parts = relToSounds.split('/');
    const game = parts.length > 1 ? parts[0] : 'Uncategorized';
    const ext = extname(full).slice(1).toLowerCase();
    let size = 0;
    try { size = statSync(full).size; } catch {}
    const analysis = ext === 'wav' ? analyzeWav(full) : null;
    return {
      id: relToSounds,          // stable key used by tags.json
      src: toUrl(full),         // URL from the site root
      name: basename(full, extname(full)),
      game,
      ext,
      size,
      duration: analysis ? analysis.duration : null,
      peakDb: analysis ? analysis.peakDb : null,   // dBFS, computed for WAV; browser fills the rest
      rmsDb: analysis ? analysis.rmsDb : null,      // dBFS (perceived loudness)
      peaks: analysis ? analysis.peaks : null,      // normalized waveform samples (0..1)
    };
  });

  const games = [...new Set(sounds.map((s) => s.game))].sort((a, b) => a.localeCompare(b));

  const payload = {
    generatedAt: new Date().toISOString(),
    count: sounds.length,
    games,
    sounds,
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  const banner = '// AUTO-GENERATED by scan.mjs — do not edit by hand. Run `node scan.mjs` to regenerate.\n';
  writeFileSync(OUTPUT, banner + 'window.__SFX_MANIFEST__ = ' + JSON.stringify(payload, null, 2) + ';\n');

  console.log(`Scanned ${sounds.length} sound(s) across ${games.length} game folder(s).`);
  console.log(`Games: ${games.join(', ') || '(none yet)'}`);
  console.log(`Wrote ${relative(__dirname, OUTPUT)}`);
}

main();
