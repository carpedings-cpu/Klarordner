import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

// Die Testdatei ist älter als ein Jahr, der Aktualitätshinweis wird mit „Später“ geschlossen.
const spaeter = async (s) => { const d = s.locator('dialog[open]'); await d.waitFor({ timeout: 3000 }).catch(() => {}); if (await d.isVisible()) await s.click('dialog[open] #dialogKnoepfe button:last-child'); };
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [], netz = [];
const ctx = await browser.newContext({ locale: 'de-DE',  acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; });
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) netz.push(r.url()); });
await p.goto(url);
await p.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
await spaeter(p);
await p.waitForSelector('.kacheln');
const ids = ['persoenlich','kontakte','gesundheit','vollmachten','finanzen','versicherungen','vertraege','wohnen','digital','zugang','sterbefall','nachricht'];
for (const [i, id] of ids.entries()) {
  await p.click(`#navliste li:nth-child(${i + 1}) button`);
  const n = await p.locator('#inhalt input, #inhalt select, #inhalt textarea').count();
  const labelsOk = await p.evaluate(() => [...document.querySelectorAll('#inhalt input:not([type=radio]), #inhalt select, #inhalt textarea')].every(e => document.querySelector(`label[for="${e.id}"]`)));
  console.log(id.padEnd(15), 'Felder:', n, 'Labels ok:', labelsOk);
}
// Werte geladen?
await p.click('#navliste li:nth-child(1) button');
console.log('Vorname:', await p.inputValue('#inhalt input >> nth=0'), '| Familienstand:', await p.locator('#inhalt select').first().inputValue());
// Kontakte: hinzufügen, tippen, Kopf aktualisiert, entfernen
await p.click('#navliste li:nth-child(2) button');
await p.click('text=+ Ansprechpartner hinzufügen');
const fokus = await p.evaluate(() => document.activeElement.closest('.eintrag') === [...document.querySelectorAll('.eintrag')].pop());
await p.keyboard.type('Neue Person');
console.log('Fokus im neuen Eintrag:', fokus, '| Kopf:', await p.locator('.eintrag h4').nth(2).textContent());
await p.locator('.eintrag').nth(1).locator('.entfernen').click();
await p.click('dialog button:has-text("Entfernen")');
console.log('Einträge nach Entfernen:', await p.locator('.eintrag h4').allTextContents());
// Vollmachten: Bedingung
await p.click('#navliste li:nth-child(4) button');
const sichtbar = async () => p.locator('.bedingt').evaluateAll(b => b.map(x => !x.hidden));
console.log('Vollmachten Details sichtbar:', await sichtbar());
await p.locator('.formkarte').nth(3).locator('label:has-text("Ja")').first().click();
console.log('Nach Ja bei Patientenverfügung:', await sichtbar());
// Versicherung: Frist-Hinweis
await p.click('#navliste li:nth-child(6) button');
console.log('Frist sichtbar (Sterbegeld):', await p.locator('.bedingt').first().isVisible());
await p.locator('.eintrag select').first().selectOption('Haftpflicht');
console.log('Frist sichtbar (Haftpflicht):', await p.locator('.bedingt').first().isVisible());
// Checkliste
await p.click('#navliste li:nth-child(11) button');
await p.locator('.checkpunkt input').nth(0).fill('Hausarzt anrufen');
// Speichern und prüfen
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnSpeichern')]);
const d = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
console.log('Gespeichert: Kontakte', d.kontakte.map(k => k.name), '| PV vorhanden', d.vollmachten.patientenverfuegung.vorhanden,
  '| Vers.art', d.versicherungen[0].art, '| Checkliste', JSON.stringify(d.sterbefall.checkliste), '| Betreuungsverf.', JSON.stringify(d.vollmachten.betreuungsverfuegung));
await p.click('dialog button:has-text("Verstanden")');
// Bilder
for (const [n, i] of [['persoenlich', 1], ['kontakte', 2], ['vollmachten', 4], ['finanzen', 5]]) {
  await p.click(`#navliste li:nth-child(${i}) button`);
  await p.screenshot({ path: path.join(hier, `ergebnisse/bild-${n}.png`), fullPage: true });
}
await p.setViewportSize({ width: 820, height: 1180 });
await p.click('text=‹ Übersicht >> nth=0');
await p.click('.kachel >> nth=8');
await p.screenshot({ path: path.join(hier, 'ergebnisse/bild-ipad-digital.png'), fullPage: true });
console.log('Fehler:', fehler, 'Netzwerk:', netz);
await browser.close();
