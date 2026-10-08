// Prüft das Porträt: auswählen, verkleinert im Ordner, Original auf dem Gerät, Traueranzeige, Deckblatt, Weitermachen.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const erg = path.join(hier, 'ergebnisse');
const bild = path.join(erg, 'testportraet.jpg');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=3000x4000', '-frames:v', '1', '-q:v', '3', bild]);
const original = fs.statSync(bild).size;
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const p = await (await browser.newContext({ locale: 'de-DE', viewport: { width: 820, height: 1180 }, acceptDownloads: true })).newPage();
await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; window.print = () => {}; });
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await p.goto(url);
await p.click('#btnNeu');
await p.waitForSelector('.portraetkopf');
pruef('Platzhalter statt Foto', await p.isVisible('.portraetkopf .portraet.leer'));
pruef('Erst „Mit dem Ausfüllen beginnen“', (await p.textContent('.weiter')) === 'Mit dem Ausfüllen beginnen');
pruef('Kein „null“ auf der Übersicht', !(await p.textContent('#inhalt')).includes('null'));

// Aufnehmen zeigt erst Tipps, dann die Kamera
await p.click('.portraetkopf button:has-text("Foto aufnehmen")');
pruef('Tipps vor der Aufnahme', (await p.textContent('#dialogTitel')) === 'Tipps für ein gutes Foto');
const [kamera] = await Promise.all([p.waitForEvent('filechooser'), p.click('dialog button:has-text("Kamera öffnen")')]);
pruef('Frontkamera angefordert', await p.getAttribute('#fotowahl', 'capture') === 'user');
await kamera.setFiles(bild);
await p.waitForSelector('.portraetkopf img');
const foto = await p.evaluate(() => zustand.daten.persoenlich.foto);
const masse = await p.evaluate(src => new Promise(ok => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = src; }), foto);
console.log(`  Original ${Math.round(original / 1024)} KB, im Ordner ${Math.round(foto.length / 1024)} KB, ${masse.join('×')} Pixel`);
pruef('Verkleinert auf höchstens 1000 Pixel', Math.max(...masse) === 1000 && foto.startsWith('data:image/jpeg'));
pruef('Klein genug für die Sicherungsdatei', foto.length < 400 * 1024);

// Original in voller Größe
await p.click('.portraetkopf button:has-text("Foto ändern oder sichern")');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('dialog button:has-text("Foto in voller Größe sichern")')]);
console.log('  Download:', dl.suggestedFilename(), fs.statSync(await dl.path()).size);
pruef('Original in voller Größe gesichert', fs.statSync(await dl.path()).size === original && dl.suggestedFilename() === 'Mein Foto.jpg');

// Persönliche Daten und Sterbefall
await p.click('.kacheln button:has-text("Persönliche Daten")');
pruef('Foto bei den persönlichen Daten', await p.isVisible('.fotozeile .portraet img'));
await p.evaluate(() => wechseln('sterbefall'));
const wunsch = p.locator('.fotowunsch');
pruef('Frage zur Traueranzeige mit Foto', await wunsch.locator('img').count() === 1);
await wunsch.locator('label:has-text("Ja")').click();
pruef('Wunsch gespeichert', await p.evaluate(() => normWert(zustand.daten.sterbefall.fotoTrauer, JA_NEIN)) === 'ja');

// Deckblatt
await p.click('#btnDrucken');
await p.click('dialog button:has-text("Drucken")').catch(() => {});
const deck = await p.evaluate(() => { const d = document.querySelector('#druck .ddeck'); return d ? { bild: !!d.querySelector('img.dfoto'), text: d.textContent } : null; });
pruef('Foto auf dem Deckblatt', deck && deck.bild);
pruef('Wunsch auf dem Deckblatt', deck && deck.text.includes('Dieses Foto wünsche ich mir für die Traueranzeige'));
// Das PDF muss auch außerhalb des Browsers vollständig gezeichnet werden.
const pdf = path.join(erg, 'portraet-deckblatt.pdf');
await p.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
execFileSync('pdftoppm', ['-gray', '-r', '20', '-f', '1', '-l', '1', pdf, path.join(erg, 'portraet-deck')]);
const pgm = fs.readFileSync(fs.readdirSync(erg).filter(f => f.startsWith('portraet-deck') && f.endsWith('.pgm')).map(f => path.join(erg, f))[0]);
const [, breite, hoehe] = pgm.toString('latin1', 0, 40).match(/P5\s+(\d+)\s+(\d+)\s+255\s/);
const pixel = pgm.subarray(pgm.length - breite * hoehe);
const unten = pixel.subarray(Math.floor(hoehe / 2) * breite).filter(v => v < 220).length;
pruef('Deckblatt im PDF vollständig gezeichnet', unten > 200);
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

// Sicherungsdatei enthält das verkleinerte Foto
const [datei] = await Promise.all([p.waitForEvent('download'), p.click('#btnMehr').then(() => p.click('#btnSpeichern'))]);
await p.click('dialog[open] button:has-text("Verstanden")').catch(() => {});
const json = JSON.parse(fs.readFileSync(await datei.path(), 'utf8'));
pruef('Foto in der Sicherungsdatei', json.persoenlich.foto === foto && json.sterbefall.fotoTrauer === 'ja');

// Weitermachen nach Neustart
await p.reload();
await p.waitForSelector('.portraetkopf img');
pruef('Nach Neustart weiter beim letzten Bereich', (await p.textContent('.weiter')) === 'Weiter, wo ich aufgehört habe');
await p.click('.weiter');
pruef('Öffnet „Für den Sterbefall“', (await p.textContent('#inhalt h2')) === 'Für den Sterbefall');

// Entfernen und Löschen vom Gerät
await p.evaluate(() => wechseln('uebersicht'));
await p.click('.portraetkopf button:has-text("Foto ändern oder sichern")');
await p.click('dialog button:has-text("Foto entfernen")');
await p.waitForSelector('.portraetkopf .portraet.leer');
pruef('Foto entfernt', await p.evaluate(async () => zustand.daten.persoenlich.foto === '' && !(await speicher.fotoLesen())));
console.log('Fehler:', fehler);
await browser.close();
