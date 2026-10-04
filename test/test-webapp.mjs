// Prüft die Web-App über einen lokalen Server: Installation, Offline-Betrieb, Speichern über Teilen.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import path from 'path';

// Die Testdatei ist älter als ein Jahr, der Aktualitätshinweis wird mit „Später“ geschlossen.
const spaeter = async (s) => { const d = s.locator('dialog[open]'); await d.waitFor({ timeout: 3000 }).catch(() => {}); if (await d.isVisible()) await s.click('dialog[open] #dialogKnoepfe button:last-child'); };
const hier = path.dirname(new URL(import.meta.url).pathname);
const server = spawn('python3', ['-m', 'http.server', '8123', '--bind', '127.0.0.1'], { cwd: path.join(hier, '../docs'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [], fremd = [];
try {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const p = await ctx.newPage();
  p.on('pageerror', e => fehler.push(e.message));
  p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  p.on('request', r => { if (!/^(http:\/\/localhost:8123|data:|blob:)/.test(r.url())) fremd.push(r.url()); });
  await p.goto('http://localhost:8123/');
  await p.evaluate(() => navigator.serviceWorker.ready);
  const manifest = (await ctx.request.get('http://localhost:8123/manifest.webmanifest')).ok() && await p.evaluate(() => !!document.querySelector('link[rel=manifest]'));
  const icon = await p.getAttribute('link[rel="apple-touch-icon"]', 'href');
  console.log('Service Worker aktiv: ja | Manifest erreichbar:', manifest, '| Home-Symbol:', icon);
  await p.reload();
  await ctx.setOffline(true);
  await p.reload();
  console.log('Offline neu geladen, Titel:', await p.textContent('.held h1'));
  await ctx.setOffline(false);

  // iPad-Weg: kein Dateizugriff, Touch, Teilen-Menü
  const ipad = await browser.newContext({ locale: 'de-DE',  viewport: { width: 820, height: 1180 }, hasTouch: true });
  const q = await ipad.newPage();
  q.on('pageerror', e => fehler.push(e.message));
  await q.addInitScript(() => {
    delete window.showOpenFilePicker; delete window.showSaveFilePicker;
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    window.__geteilt = null;
    navigator.canShare = () => true;
    navigator.share = async d => { window.__geteilt = { name: d.files[0].name, text: await d.files[0].text() }; };
  });
  await q.goto('http://localhost:8123/');
  console.log('iPad-Hinweis:', await q.textContent('#hinweisBrowser'));
  await q.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
  await spaeter(q);
  await q.waitForSelector('.kacheln');
  await q.click('.kachel:has-text("Persönliche Nachricht")');
  await q.fill('textarea', 'Gespeichert über Teilen');
  await q.click('#btnSpeichern');
  console.log('Dialog vor dem Teilen:', await q.textContent('#dialogTitel'));
  await q.click('dialog button:has-text("Weiter")');
  await q.waitForFunction(() => window.__geteilt);
  const g = await q.evaluate(() => window.__geteilt);
  console.log('Geteilt:', g.name, '| Text drin:', JSON.parse(g.text).nachricht.text, '| Status:', await q.textContent('#dateistatus'));
  await q.fill('textarea', 'Zweites Speichern');
  await q.click('#btnSpeichern');
  await q.waitForFunction(() => window.__geteilt && window.__geteilt.text.includes('Zweites'));
  console.log('Zweites Speichern ohne erneuten Hinweis: ok, Dialog offen:', await q.isVisible('dialog[open]'));
} finally {
  console.log('Fehler:', fehler, 'Fremde Anfragen:', fremd);
  await browser.close();
  server.kill();
}
