// Prüft das automatische Speichern im Gerät, die Sicherung als Datei und das Löschen vom Gerät.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

// Die Testdatei ist älter als ein Jahr, der Aktualitätshinweis wird mit „Später“ geschlossen.
const spaeter = async (s) => { const d = s.locator('dialog[open]'); await d.waitFor({ timeout: 3000 }).catch(() => {}); if (await d.isVisible()) await s.click('dialog[open] #dialogKnoepfe button:last-child'); };
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ locale: 'de-DE',  acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const fehler = [];
await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; });
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await p.goto(url);
await p.click('#btnNeu');
await p.waitForSelector('.kacheln');
console.log('Neu angelegt, Status:', await p.textContent('#dateistatus'));
await p.click('.kachel:has-text("Persönliche Daten")');
await p.fill('#inhalt input >> nth=0', 'Erika');
console.log('Beim Tippen:', await p.textContent('#dateistatus'));
await p.waitForFunction(() => document.querySelector('#dateistatus').textContent.includes('Auf diesem Gerät'));
console.log('Nach kurzer Pause:', await p.textContent('#dateistatus'));
await p.reload();
await p.waitForSelector('.kacheln');
console.log('Nach Neustart direkt im Ordner, Sicherungskarte:', (await p.textContent('.sicherung .sicherungsstand')).trim(), '| gelb markiert:', await p.locator('.sicherung.dringend').count() === 1);
await p.click('.kachel:has-text("Persönliche Daten")');
console.log('Vorname nach Neustart:', await p.inputValue('#inhalt input >> nth=0'));
await p.click('#navStart button');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sicherung button:has-text("Als Datei sichern")')]);
const d = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
await p.click('dialog button:has-text("Verstanden")');
console.log('Gesichert:', dl.suggestedFilename(), d.persoenlich.vorname, '| Karte:', (await p.textContent('.sicherung .sicherungsstand')).trim(), '| gelb markiert:', await p.locator('.sicherung.dringend').count() === 1);
// Datei öffnen ersetzt den Ordner nach Rückfrage
await p.click('#btnOeffnen');
console.log('Rückfrage:', await p.textContent('#dialogTitel'));
await p.click('dialog button:has-text("Ersetzen")');
await p.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
await spaeter(p);
await p.waitForFunction(() => (document.querySelector('.stand') || {}).textContent?.includes('14.06.2025'));
await p.waitForTimeout(300);
await p.reload();
await p.waitForSelector('.kacheln');
await spaeter(p);
await p.click('.kachel:has-text("Persönliche Daten")');
console.log('Nach Öffnen und Neustart:', await p.inputValue('#inhalt input >> nth=1'));
// Löschen vom Gerät
await p.click('#navStart button');
await p.click('.sicherung button:has-text("Von diesem Gerät löschen")');
await p.click('dialog button:has-text("Endgültig löschen")');
await p.waitForSelector('#startseite:not([hidden])', { timeout: 3000 }).catch(() => {});
console.log('Nach Löschen Startseite sichtbar:', await p.isVisible('#startseite'));
await p.reload();
console.log('Nach Neustart weiterhin leer:', await p.isVisible('#startseite'));
console.log('Fehler:', fehler);
await browser.close();
