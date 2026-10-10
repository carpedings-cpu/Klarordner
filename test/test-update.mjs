// Prüft das Update der installierten Web-App: neue Version erkennen, Hinweis zeigen, neu laden, Eingaben behalten.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'klarordner-update-'));
fs.cpSync(path.join(hier, '../docs'), ordner, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '8124', '--bind', '127.0.0.1'], { cwd: ordner, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
try {
  const p = await (await browser.newContext({ locale: 'de-DE' })).newPage();
  p.on('pageerror', e => fehler.push(e.message));
  await p.goto('http://localhost:8124/app/');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.click('#btnNeu');
  await p.waitForSelector('.kacheln');
  await p.click('.kachel:has-text("Persönliche Daten")');
  await p.fill('#inhalt input >> nth=0', 'Erika');
  await p.waitForTimeout(800);
  pruef('Kein Hinweis ohne neue Version', !(await p.locator('#neueVersion').count()));
  // Neue Version bereitstellen und die Rückkehr in die App simulieren
  const sw = path.join(ordner, 'app', 'sw.js');
  fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/klarordner-[0-9a-f]+/, 'klarordner-neu123'));
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.locator('#neueVersion').waitFor({ timeout: 8000 }).catch(() => {});
  pruef('Hinweis auf neue Version erscheint', await p.locator('#neueVersion').isVisible());
  await Promise.all([p.waitForEvent('load'), p.click('#neueVersion button')]);
  await p.waitForTimeout(500);
  pruef('Nach dem Neuladen kein Hinweis mehr', !(await p.locator('#neueVersion').count()));
  pruef('Neue Version im Cache', (await p.evaluate(() => caches.keys())).join() === 'klarordner-neu123');
  pruef('Eingaben erhalten', await p.evaluate(() => zustand.daten.persoenlich.vorname) === 'Erika');
} finally {
  console.log('Fehler:', fehler);
  await browser.close();
  server.kill();
  fs.rmSync(ordner, { recursive: true, force: true });
}
