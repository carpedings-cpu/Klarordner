// Prüft Trauerkarten, Traueranzeige und Danksagung: Vorlagen, Spruch, Vorschau, Zeitungstext, Druck, Druckdienste, Migration.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const spaeter = async (s) => { const d = s.locator('dialog[open]'); await d.waitFor({ timeout: 3000 }).catch(() => {}); if (await d.isVisible()) await s.click('dialog[open] #dialogKnoepfe button:last-child'); };
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [], fremd = [];
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 1180, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; window.print = () => { window.__gedruckt = (window.__gedruckt || 0) + 1; }; });
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
ctx.on('request', r => { if (!/^(file:|data:|blob:)/.test(r.url())) fremd.push(r.url()); });
await p.goto(url);
await p.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
await spaeter(p);
pruef('Migration legt die Kartenfelder an', await p.evaluate(() => zustand.daten.sterbefall.karten && zustand.daten.sterbefall.karten.vorlage === 'salbei' && !('traueranzeige' in zustand.daten.sterbefall)));
await p.click('#navliste button[data-id=sterbefall]');
const gruppe = p.locator('.formkarte', { has: p.locator('h3', { hasText: 'Trauerkarten und Anzeigen' }) });
pruef('Gruppe mit zehn Vorlagen', await gruppe.locator('.vorlage').count() === 10 && await gruppe.locator('.vorlage.aktiv .vname').textContent() === 'Salbei');
pruef('Jede Vorlage zeigt Name und Daten', await gruppe.locator('.vorlage .kname').evaluateAll(l => l.every(e => e.textContent === 'Erika Musterfrau')));
await gruppe.locator('.vorlage', { hasText: 'Kerze' }).click();
pruef('Vorlage gespeichert', await p.evaluate(() => zustand.daten.sterbefall.karten.vorlage) === 'kerze');
const spruch = gruppe.locator('select >> nth=0');
pruef('Sprüche in vier Gruppen', await spruch.locator('optgroup').count() === 4 && await spruch.locator('option').count() > 25);
await spruch.selectOption({ label: 'Der Herr ist mein Hirte, mir wird nichts mangeln. (Psalm 23,1)' });
pruef('Spruch gespeichert', (await p.evaluate(() => zustand.daten.sterbefall.karten.spruch)).startsWith('Der Herr ist mein Hirte'));
await gruppe.locator('textarea >> nth=1').fill('Thomas Musterfrau\nGisela Nachbarin');
await gruppe.locator('textarea >> nth=2').fill('Die Trauerfeier findet am 3. Oktober um 14 Uhr in der Friedhofskapelle statt.');
await gruppe.locator('input[type=text] >> nth=1').fill('den Hospizverein Fulda');
await p.evaluate(() => { zustand.daten.schreiben.sterbedatum = '2026-09-20'; zustand.daten.schreiben.ort = 'Beispielstadt'; });

// Traueranzeige
await gruppe.locator('button:has-text("Traueranzeige")').click();
await p.waitForSelector('dialog[open] .tkarte');
const anzeige = await p.textContent('dialog[open] .kartenvorschau');
pruef('Vorschau mit Spruch, Name, Daten, Trauernden, Feier und Spende', ['Der Herr ist mein Hirte', 'Psalm 23,1', 'Erika Musterfrau', 'geb. Beispiel', '17.03.1952', '20.09.2026', 'In stiller Trauer', 'Gisela Nachbarin', 'Friedhofskapelle', 'Hospizverein Fulda', 'September 2026'].every(x => anzeige.includes(x)));
pruef('Vorschau in der gewählten Vorlage mit Foto-Wunsch beachtet', await p.locator('dialog[open] .tkarte.v-kerze').count() === 1);
const zeitung = await p.inputValue('dialog[open] .anzeigentext');
pruef('Zeitungstext vollständig', zeitung.startsWith('Der Herr ist mein Hirte') && zeitung.includes('* 17.03.1952 in Musterhausen   † 20.09.2026') && zeitung.includes('In stiller Trauer\nThomas Musterfrau\nGisela Nachbarin'));
const dienste = await p.locator('dialog[open] .dienstliste a').evaluateAll(l => l.map(a => [a.textContent, a.href, a.target, a.rel]));
pruef('Fünf Druckdienste als Links in neuem Fenster', dienste.length === 5 && dienste.every(d => d[1].startsWith('https://') && d[2] === '_blank' && d[3] === 'noopener'));
await p.click('dialog[open] button:has-text("Drucken oder als PDF sichern")');
const druck1 = await p.evaluate(() => ({ n: window.__gedruckt, klasse: document.querySelector('#druck').className, seiten: document.querySelectorAll('#druck .dkarte').length, text: document.querySelector('#druck').textContent, stil: document.querySelector('#druckSeiten').textContent }));
pruef('Anzeige als eine A5-Seite gedruckt', druck1.n === 1 && druck1.klasse === 'karten' && druck1.seiten === 1 && druck1.stil.includes('A5 portrait') && druck1.text.includes('Erika Musterfrau'));
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

// Trauerkarte als Klappkarte
await gruppe.locator('button:has-text("Trauerkarte")').click();
await p.waitForSelector('dialog[open] .tkarte');
pruef('Trauerkarte mit Vorder- und Innenseite', await p.locator('dialog[open] .kseite').count() === 2 && (await p.textContent('dialog[open] .kseite.innen')).includes('Wir nehmen Abschied von Erika Musterfrau.'));
await p.click('dialog[open] button:has-text("Drucken oder als PDF sichern")');
const druck2 = await p.evaluate(() => ({ seiten: document.querySelectorAll('#druck .dblatt').length, haelften: document.querySelectorAll('#druck .dhalb').length, stil: document.querySelector('#druckSeiten').textContent }));
pruef('Klappkarte: zwei Blätter A5 quer mit je zwei Hälften', druck2.seiten === 2 && druck2.haelften === 4 && druck2.stil.includes('A5 landscape'));
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

// Danksagung mit Spendentext
await gruppe.locator('select >> nth=1').selectOption('spenden');
await gruppe.locator('button:has-text("Danksagung")').click();
await p.waitForSelector('dialog[open] .tkarte');
const dank = await p.textContent('dialog[open] .kartenvorschau');
pruef('Danksagung mit Dank, Spende und Angehörigen', dank.includes('Danke') && dank.includes('Die Spenden kommen den Hospizverein Fulda zugute.') && dank.includes('Im Namen aller Angehörigen'));
await p.click('dialog[open] button:has-text("Schließen")');

// Eigener Spruch hat Vorrang, Druck des Bereichs nennt Vorlage und Spruch
await gruppe.locator('textarea >> nth=0').fill('Du fehlst uns jeden Tag.');
pruef('Eigener Spruch in der Vorschau', (await gruppe.locator('.vorlage.aktiv .kspruch').textContent()).includes('Du fehlst uns jeden Tag.'));
await p.click('#btnDrucken');
await p.click('dialog button:has-text("Drucken")').catch(() => {});
const bereich = await p.textContent('#druck');
pruef('Ausdruck nennt Vorlage und Spruch', bereich.includes('Gewählte Vorlage') && bereich.includes('Kerze') && bereich.includes('Du fehlst uns jeden Tag.'));
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

// Ohne Angaben: Platzhalter statt leerer Karte, kein Fehler
await p.evaluate(async () => { await speicher.loeschen?.(); });
await p.goto(url);
await p.click('#btnNeu');
await p.waitForSelector('.kacheln');
await p.click('.kachel:has-text("Für den Sterbefall")');
const leer = p.locator('.formkarte', { has: p.locator('h3', { hasText: 'Trauerkarten und Anzeigen' }) });
pruef('Leerer Ordner: Vorlagen mit Platzhaltern', await leer.locator('.vorlage').count() === 10 && (await leer.locator('.vorlage.aktiv .kname').textContent()) === 'Vorname Nachname');
console.log('Fehler:', fehler, 'Fremde Anfragen:', fremd);
await browser.close();
