// Prüft die Druckauswahl, den Ausdruck als PDF (Kopf, Fuß, Seitenzahl, Formular) und das Drucken der Zugangsdaten.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Die Testdatei ist älter als ein Jahr, der Aktualitätshinweis wird mit „Später“ geschlossen.
const spaeter = async (s) => { const d = s.locator('dialog[open]'); await d.waitFor({ timeout: 3000 }).catch(() => {}); if (await d.isVisible()) await s.click('dialog[open] #dialogKnoepfe button:last-child'); };
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const erg = path.join(hier, 'ergebnisse');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const pdfText = async (p, name) => {
  const bereiche = await p.evaluate(() => document.querySelectorAll('#druck .dbereich').length);
  if (!bereiche) throw new Error('Druckansicht ist leer: ' + name);
  const datei = path.join(erg, name + '.pdf');
  await p.pdf({ path: datei, preferCSSPageSize: true, printBackground: true });
  const seiten = Number(execFileSync('pdfinfo', [datei]).toString().match(/Pages:\s+(\d+)/)[1]);
  return { text: execFileSync('pdftotext', ['-layout', datei, '-']).toString(), seiten, datei };
};
const seite = async (locale) => {
  const ctx = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; window.print = () => { window.__gedruckt = (window.__gedruckt || 0) + 1; }; });
  p.on('pageerror', e => fehler.push(e.message));
  p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  await p.goto(url);
  return p;
};

// 1. Testdaten, Oberfläche auf Englisch, Ausdruck trotzdem auf Deutsch
let p = await seite('en-GB');
await p.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
await spaeter(p);
await p.waitForSelector('.kacheln');
await p.click('#btnDrucken');
const boxen = await p.locator('.druckliste input').evaluateAll(l => l.map(i => `${i.value}:${i.checked ? 'an' : 'aus'}${i.disabled ? ':gesperrt' : ''}`));
console.log('Auswahl:', boxen.join(' '));
console.log('Hinweis Deutsch:', await p.isVisible('text=The printout is in German'));
await p.click('dialog button:has-text("Print")');
console.log('Druck aufgerufen:', await p.evaluate(() => window.__gedruckt));
const a = await pdfText(p, 'druck-testdaten');
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);
console.log('PDF Seiten:', a.seiten);
pruef('Deckblatt mit Name', a.text.includes('Vorsorgeordner für meine Angehörigen') && a.text.includes('Erika Musterfrau'));
pruef('geboren am 17.03.1952', a.text.includes('geboren am 17.03.1952'));
pruef('Kopfzeile Bereichsname', /1\. Persönliche Daten[\s\S]*Erika Musterfrau/.test(a.text));
pruef('Fußzeile Stand', a.text.includes('Stand: 14.06.2025'));
pruef('Seitenzahl', new RegExp(`Seite 2 von ${a.seiten}`).test(a.text));
pruef('Werte gedruckt', a.text.includes('Lindenweg 4') && a.text.includes('Thomas Musterfrau'));
pruef('Auswahl als Text', a.text.includes('verwitwet') && a.text.includes('Sterbegeldversicherung'));
pruef('Kästchen angekreuzt', a.text.includes('☒ Ja'));
pruef('Leere Checkliste mit Kästchen', a.text.includes('☐ Arzt rufen'));
pruef('Hinweis Frist', a.text.includes('Eilt im Todesfall'));
pruef('Ohne Zugangsdaten', !a.text.includes('9. Zugangsdaten'));
pruef('Kein Bereich Gesundheit mehr', !a.text.includes('Gesundheit') && !a.text.includes('Allergien'));
pruef('Testament-Bereich', a.text.includes('3. Testament und Vollmachten') && a.text.includes('Haben Sie ein Testament?'));
pruef('Hausarzt und Krankenkasse umgezogen', a.text.includes('Dr. Beispiel') && a.text.includes('Beispiel-Krankenkasse'));
pruef('Kein Englisch im Ausdruck', !a.text.includes('Personal details') && !a.text.includes('Contacts'));
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
console.log('Nach dem Druck geleert:', await p.evaluate(() => !document.getElementById('druck').firstChild));
execFileSync('pdftoppm', ['-r', '50', '-png', '-f', '1', '-l', '6', a.datei, path.join(erg, 'seite')]);

// 2. Leerer Ordner: alles als Formular
p = await seite('de-DE');
await p.click('#btnNeu');
await p.click('#btnDrucken');
await p.click('dialog button:has-text("Drucken")');
const b = await pdfText(p, 'druck-leer');
console.log('Leerer Ordner, PDF Seiten:', b.seiten);
pruef('Leere Listen mit Einträgen zum Ausfüllen', b.text.includes('Ansprechpartner 1') && b.text.includes('Ansprechpartner 2'));
pruef('Ja/Nein als Kästchen', b.text.includes('☐ Ja') && b.text.includes('☐ Nein'));
pruef('Kurze Auswahl als Kästchen', b.text.includes('☐ verheiratet'));
execFileSync('pdftoppm', ['-r', '50', '-png', '-f', '2', '-l', '3', b.datei, path.join(erg, 'leer')]);

// 3. Zugangsdaten: gesperrt nicht wählbar, offen mit Warnung
await p.click('#navliste button[data-id=zugang]');
await p.locator('#inhalt input[type=password]').nth(0).fill('Mein Hund heisst Bello');
await p.locator('#inhalt input[type=password]').nth(1).fill('Mein Hund heisst Bello');
await p.check('.bestaetigung input');
await p.click('button:has-text("Zugangsdaten schützen")');
await p.waitForSelector('text=Jetzt sperren');
await p.click('text=+ Zugang hinzufügen');
await p.locator('.eintrag input').nth(0).fill('iPhone');
await p.locator('.eintrag input[type=password]').fill('Geheim-0815');
await p.click('#btnDrucken');
console.log('Zugangsdaten wählbar wenn offen:', await p.locator('.druckliste input[value=zugang]').isEnabled());
await p.check('.druckliste input[value=zugang]');
await p.click('dialog button:has-text("Drucken")');
console.log('Warnung:', await p.textContent('#dialogTitel'));
await p.click('dialog button:has-text("Mit Zugangsdaten drucken")');
const c = await pdfText(p, 'druck-zugang');
pruef('Passwort im Ausdruck', c.text.includes('Geheim-0815') && c.text.includes('Vertraulich'));
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await p.click('#btnDrucken');
await p.check('.druckliste input[value=zugang]');
await p.click('dialog button:has-text("Drucken")');
await p.click('dialog button:has-text("Ohne Zugangsdaten drucken")');
const d = await pdfText(p, 'druck-ohne');
pruef('„Ohne“ lässt Passwort weg', !d.text.includes('Geheim-0815'));
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await p.click('button:has-text("Jetzt sperren")');
await p.click('#btnDrucken');
console.log('Gesperrt nicht wählbar:', await p.locator('.druckliste input[value=zugang]').isDisabled());
await p.click('dialog button:has-text("Abbrechen")');

// 4. Druck über das Browsermenü
await p.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
console.log('Strg+P füllt Druckansicht:', await p.evaluate(() => document.querySelectorAll('#druck .dbereich').length));
console.log('Fehler:', fehler);
await browser.close();
