// Records a short walkthrough of index.html and saves it as videos/showcase.webm.
// Runs on GitHub Actions (x64 Linux) since Chrome has no official Linux ARM build.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const file = await readFile(path.join(root, 'index.html'));
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

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const url = `http://localhost:${port}/`;

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
    recordVideo: { dir: path.join(root, 'videos'), size: { width: 430, height: 900 } }
  });
  const page = await context.newPage();

  await page.goto(url);
  await page.waitForTimeout(2200);

  // Strategy tab
  await page.click('[data-tab="strategy"]');
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    document.getElementById('screen-strategy').scrollTo({ top: 260, behavior: 'smooth' });
  });
  await page.waitForTimeout(1800);

  // Play tab: place a bet and play a hand
  await page.click('[data-tab="play"]');
  await page.waitForTimeout(900);
  await page.click('.chip[data-value="25"]');
  await page.click('.chip[data-value="25"]');
  await page.waitForTimeout(400);
  await page.click('#btnDeal');
  await page.waitForTimeout(1300);

  if (await page.locator('#insurancePanel').isVisible()) {
    await page.click('#btnInsureNo');
    await page.waitForTimeout(900);
  }
  if (await page.locator('#actionPanel').isVisible()) {
    if (await page.locator('#btnHit').isEnabled()) {
      await page.click('#btnHit');
      await page.waitForTimeout(900);
    }
    if (await page.locator('#btnStand').isVisible()) {
      await page.click('#btnStand');
      await page.waitForTimeout(1600);
    }
  }
  await page.waitForTimeout(700);

  // Trainer tab: run the speed drill briefly
  await page.click('[data-tab="trainer"]');
  await page.waitForTimeout(900);
  await page.click('#btnDrillStart');
  await page.waitForTimeout(2600);
  await page.click('#btnDrillStop');
  await page.waitForTimeout(500);
  await page.fill('#drillGuessInput', '2');
  await page.click('#btnDrillSubmit');
  await page.waitForTimeout(1800);

  await context.close();
  await browser.close();
  server.close();

  const files = await readdir(path.join(root, 'videos'));
  const webm = files.find((f) => f.endsWith('.webm'));
  if (webm) {
    await rename(path.join(root, 'videos', webm), path.join(root, 'videos', 'showcase.webm'));
  } else {
    throw new Error('No .webm output found from Playwright recording');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
