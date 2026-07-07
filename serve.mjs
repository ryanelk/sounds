// serve.mjs — tiny zero-dependency static server for local previewing.
//
// Usage:  node serve.mjs           (serves at http://localhost:8080)
//         node serve.mjs 3000      (custom port)
//
// You can also just open index.html directly (file://) — the manifest still loads —
// but a server is closer to how GitHub Pages will behave and avoids browser file:// quirks.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 8080;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
  '.weba': 'audio/webm', '.webm': 'audio/webm', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    // Prevent path traversal outside ROOT.
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) { res.writeHead(404).end('Not found'); return; }

    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Accept-Ranges': 'bytes',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500).end('Server error');
  }
});

server.listen(PORT, () => {
  console.log(`SFX Library serving at  http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
