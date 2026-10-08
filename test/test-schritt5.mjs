// Prüft Aktualitätshinweis, Fortschrittsanzeige und Sicherungskopie mit Datum.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const ctx = await browser.newContext({ locale: 'de-DE', acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; });
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await p.goto(url);
const stufen = () => p.locator('.kachel .stufe').allTextContents();

// Fortschritt im leeren Ordner
await p.click('#btnNeu');
await p.waitForSelector('.kacheln');
console.log('Leer:', (await stufen()).every(s => s === 'Noch leer'), '|', await p.textContent('.fortschritt-text'), '| Balken:', await p.getAttribute('.balken', 'aria-valuenow'));
console.log('Kein Aktualitätshinweis bei neuem Ordner:', !(await p.isVisible('dialog[open]')) && (await p.locator('.formkarte.aktuell').count()) === 0);
await p.click('.kachel:has-text("Persönliche Nachricht")');
await p.fill('textarea', 'Hallo');
await p.click('.kachel-zurueck, #navStart button');
console.log('Nachricht ausgefüllt:', (await stufen())[8], '|', await p.textContent('.fortschritt-text'));
await p.click('.kachel:has-text("Persönliche Daten")');
await p.fill('#inhalt input >> nth=0', 'Erika');
await p.click('#navStart button');
console.log('Persönliche Daten teilweise:', (await stufen())[0]);
const ringBreite = await p.locator('.kachel .ring .wert').first().evaluate(c => c.style.strokeDasharray);
console.log('Ringanteil 1 von 7:', ringBreite);

// Testdatei: älter als ein Jahr
await p.click('#btnOeffnen');
await p.click('dialog button:has-text("Ersetzen")');
await p.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
await p.waitForSelector('dialog[open]');
console.log('Hinweis beim Öffnen:', await p.textContent('#dialogTitel'), '|', (await p.textContent('#dialogText')).slice(0, 60));
await p.click('dialog button:has-text("Später")');
console.log('Gelbe Karte in der Übersicht:', await p.locator('.formkarte.aktuell').count() === 1);
console.log('Stufen Testdaten:', (await stufen()).join(', '));
await p.click('.formkarte.aktuell button:has-text("Alles ist noch aktuell")');
const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
console.log('Stand jetzt heute:', (await p.textContent('.stand')).includes(heute), '| Karte weg:', await p.locator('.formkarte.aktuell').count() === 0);
await p.waitForTimeout(700);
await p.reload();
await p.waitForSelector('.kacheln');
console.log('Nach Neustart kein Hinweis mehr:', !(await p.isVisible('dialog[open]')));

// "Jetzt durchsehen" springt in den ersten Bereich
await p.evaluate(() => { zustand.daten.lastModified = '2024-01-01T10:00:00.000Z'; zustand.aktualitaetGefragt = false; aktualitaetPruefen(); });
await p.click('dialog button:has-text("Jetzt durchsehen")');
console.log('Durchsehen öffnet:', await p.textContent('#inhalt h2'));

// Sicherungskopie mit Datum, ohne den gemerkten Dateinamen zu ändern
await p.click('#navStart button');
const vorher = await p.evaluate(() => zustand.dateiname);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sicherung button:has-text("Sicherungskopie mit Datum")')]);
const datum = new Date().toISOString().slice(0, 10);
console.log('Kopie:', dl.suggestedFilename(), '| Datum im Namen:', dl.suggestedFilename() === `Mein Vorsorgeordner ${datum}.notfall.json`);
console.log('Meldung:', await p.textContent('#dialogTitel'));
await p.click('dialog button:has-text("Verstanden")');
console.log('Dateiname unverändert:', (await p.evaluate(() => zustand.dateiname)) === vorher, '| Inhalt gültig:', JSON.parse(fs.readFileSync(await dl.path(), 'utf8')).format === 'klarordner');

// Chrome-Weg: Kopie über eigenen Speicherdialog, gemerkte Datei bleibt
const q = await (await browser.newContext({ locale: 'de-DE' })).newPage();
q.on('pageerror', e => fehler.push(e.message));
await q.addInitScript(() => {
  window.__dateien = {};
  const handle = name => ({ name, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    createWritable: async () => ({ write: async t => { window.__dateien[name] = t; }, close: async () => {} }) });
  window.__vorschlaege = [];
  window.showSaveFilePicker = async o => { window.__vorschlaege.push(o.suggestedName); return handle(o.suggestedName); };
  window.showOpenFilePicker = async () => [];
});
await q.goto(url);
await q.click('#btnNeu');
await q.click('.sicherung button:has-text("Als Datei sichern")');
await q.waitForFunction(() => Object.keys(window.__dateien).length === 1);
await q.click('.sicherung button:has-text("Sicherungskopie mit Datum")');
await q.waitForFunction(() => Object.keys(window.__dateien).length === 2);
console.log('Chrome-Weg Dateien:', await q.evaluate(() => Object.keys(window.__dateien).join(' + ')));
await q.click('.sicherung button:has-text("Als Datei sichern")');
await q.waitForTimeout(300);
console.log('Normales Sichern schreibt wieder in die erste Datei:', await q.evaluate(() => window.__vorschlaege.length === 2));

console.log('Fehler:', fehler);
await browser.close();
