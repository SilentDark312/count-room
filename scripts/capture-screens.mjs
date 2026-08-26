// Dev-only QA helper: captures plain screenshots of specific screens/states so a
// change can be visually reviewed from a sandbox with no real browser. Not part of
// the curated showcase pipeline (see record-showcase.mjs for that).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'verify');

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
  await mkdir(outDir, { recursive: true });
  const server = await startServer();
  const port = server.address().port;
  const url = `http://localhost:${port}/`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(300);

  // 1. Learn tab, scrolled to the new "Reading the Count" section
  await page.click('[data-tab="learn"]');
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('#screen-learn h2')]
      .find(h => h.textContent.includes('now what'));
    heading?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '01-learn-reading-the-count.png') });

  // 1b. Learn tab, bankroll/risk-of-ruin simulator after running it
  await page.evaluate(() => {
    document.getElementById('riskSimCard')?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(200);
  await page.click('#btnRunSim');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, '01b-learn-risk-simulator.png') });

  // 2. Trainer tab, Strategy Trainer segment
  await page.click('[data-tab="trainer"]');
  await page.click('#segStrategy');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '02-trainer-strategy-before-answer.png') });
  await page.click('#stratStand');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, '02a-trainer-strategy-after-answer.png') });

  // 2b. Speed Drill mid-run (regression check: drillStopRow used to silently
  // ignore [hidden] because of a class/attribute specificity clash)
  await page.click('#segSpeed');
  await page.click('#btnDrillStart');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '02b-trainer-speed-drill-running.png') });
  await page.click('#btnDrillStop');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, '02c-trainer-speed-drill-guess.png') });

  // 3. Play tab, Challenge mode just entered
  await page.click('[data-tab="play"]');
  await page.click('#modeChallenge');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '03-play-challenge-mode.png') });

  // 4. Play tab, Challenge mode busted-out screen (bet it all until it's gone)
  for (let i = 0; i < 50; i++) {
    const overHidden = await page.locator('#challengeOverPanel').isHidden();
    if (!overHidden) break;
    if (await page.locator('#bettingPanel').isVisible()) {
      const bal = parseInt((await page.locator('#bankrollVal').textContent()).replace(/[$,]/g, ''), 10);
      const chip = bal >= 500 ? '500' : bal >= 100 ? '100' : bal >= 25 ? '25' : '5';
      await page.click(`.chip[data-value="${chip}"]`);
      await page.click('#btnDeal');
    }
    if (await page.locator('#insurancePanel').isVisible()) await page.click('#btnInsureNo');
    if (await page.locator('#actionPanel').isVisible()) {
      if (!(await page.locator('#btnStand').isDisabled())) await page.click('#btnStand');
      else await page.click('#btnHit');
    }
    if (await page.locator('#nextPanel').isVisible()) await page.click('#btnNextRound');
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '04-play-challenge-busted.png') });

  // 5. Play tab, Count Drill mode -- before and after a count check
  // (step 4 may or may not have ended on the busted/challengeOver screen,
  // where the mode buttons are hidden -- get back to a normal betting
  // screen first, however step 4 left things)
  if (await page.locator('#challengeOverPanel').isVisible()) {
    await page.click('#btnChallengeToFree');
  } else {
    await page.click('#modeFree');
  }
  await page.click('#modeDrill');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '05-play-drill-before-check.png') });
  await page.fill('#countCheckInput', '0');
  await page.click('#btnCountCheck');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, '05b-play-drill-after-check.png') });

  await browser.close();
  server.close();
  console.log('Screenshots written to verify/');
}

main().catch((err) => { console.error(err); process.exit(1); });
