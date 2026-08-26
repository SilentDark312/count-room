// Renders scripts/icon-src.html at each size/variant an app icon is needed in,
// using Playwright's viewport to get crisp native-resolution output at every
// size rather than downscaling one bitmap (icon-src.html's CSS is written in
// viewport-relative units so it re-lays-out cleanly at any requested size).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'icons');

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const file = await readFile(path.join(__dirname, 'icon-src.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(file);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, () => resolve(server));
  });
}

async function shot(browser, url, size, outFile) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.goto(url);
  await page.waitForTimeout(50);
  await page.screenshot({ path: outFile });
  await page.close();
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const server = await startServer();
  const port = server.address().port;
  const base = `http://localhost:${port}/`;

  const browser = await chromium.launch();
  await shot(browser, base, 512, path.join(iconsDir, 'icon-512.png'));
  await shot(browser, base, 192, path.join(iconsDir, 'icon-192.png'));
  await shot(browser, base + '?safe=1', 512, path.join(iconsDir, 'icon-512-maskable.png'));
  await shot(browser, base + '?solid=1', 180, path.join(iconsDir, 'apple-touch-icon.png'));
  await shot(browser, base, 32, path.join(iconsDir, 'favicon-32.png'));
  await shot(browser, base, 16, path.join(iconsDir, 'favicon-16.png'));
  await browser.close();
  server.close();
  console.log('Icons written to icons/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
