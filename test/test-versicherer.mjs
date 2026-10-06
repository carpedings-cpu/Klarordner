// Prüft die Auswahl der Versicherer und Krankenkassen und die Übernahme von Anschrift und Nummer in die Schreiben.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { execFileSync } from 'child_process';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const erg = path.join(hier, 'ergebnisse');
const spaeter = async (s) => { const d = s.locator('dialog[open]'); await d.waitFor({ timeout: 3000 }).catch(() => {}); if (await d.isVisible()) await s.click('dialog[open] #dialogKnoepfe button:last-child'); };
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const p = await (await browser.newContext({ locale: 'de-DE', viewport: { width: 1280, height: 900 } })).newPage();
await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; window.print = () => {}; });
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await p.goto(url);
await p.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
await spaeter(p);
const anzahl = await p.evaluate(() => ({ v: ANBIETER.filter(a => a.typ === 'versicherung').length, k: ANBIETER.filter(a => a.typ === 'krankenkasse').length }));
console.log('Versicherer:', anzahl.v, '| Krankenkassen:', anzahl.k);

// Bestehender Eintrag mit unbekannter Gesellschaft: steht unter „Andere“
await p.click('#navliste button[data-id=versicherungen]');
const erste = p.locator('.eintrag').first();
pruef('Unbekannte Gesellschaft bleibt als freier Eintrag', await erste.locator('.gesellschaft select').inputValue() === '__andere'
  && await erste.locator('.gesellschaft input[type=text]').inputValue() === 'Muster-Versicherung');

// Neue Lebensversicherung bei der Allianz
await p.click('text=+ Versicherung hinzufügen');
let neu = p.locator('.eintrag').last();
await neu.locator('select').first().selectOption('Lebensversicherung');
await neu.locator('.gesellschaft select').selectOption('allianz');
await neu.locator('.feld', { hasText: 'Versicherungsnummer' }).locator('input').fill('LV-778899');
pruef('Anschrift wird unter der Auswahl angezeigt', (await neu.locator('.anschrift').textContent()).includes('10842 Berlin'));
pruef('Freies Feld bleibt verborgen', !(await neu.locator('.gesellschaft input[type=text]').isVisible()));

// Hausrat bei der AXA: Anschrift der Sachversicherung
await p.click('text=+ Versicherung hinzufügen');
neu = p.locator('.eintrag').last();
await neu.locator('select').first().selectOption('Hausrat');
await neu.locator('.gesellschaft select').selectOption('axa');
await neu.locator('.feld', { hasText: 'Versicherungsnummer' }).locator('input').fill('HR 12-345');

// Freie Gesellschaft
await p.click('text=+ Versicherung hinzufügen');
neu = p.locator('.eintrag').last();
await neu.locator('.gesellschaft select').selectOption('__andere');
await neu.locator('.gesellschaft input[type=text]').fill('Kleine Ortsversicherung');

const vers = await p.evaluate(() => zustand.daten.versicherungen.map(v => [v.art, v.gesellschaft, v.vertragsnummer].join('/')));
console.log('Gespeichert:', vers.join(' | '));
pruef('Name der Gesellschaft gespeichert', vers.includes('leben/Allianz/LV-778899') && vers.includes('hausrat/AXA/HR 12-345') && vers.some(v => v.includes('Kleine Ortsversicherung')));

// Krankenkasse aus der Liste
await p.click('#navliste button[data-id=persoenlich]');
const kk = p.locator('.gesellschaft', { hasText: 'Krankenkasse' });
await kk.locator('select').selectOption('tk');
const tk = await p.evaluate(() => ANBIETER.find(a => a.id === 'tk'));
pruef('Krankenkasse übernommen', await p.evaluate(() => zustand.daten.persoenlich.krankenkasse.name) === tk.name);

// Schreiben
await p.click('#navliste button[data-id=sterbefall]');
await p.click('button:has-text("Schreiben vorbereiten")');
const empf = async (text) => { const z = p.locator('.schreibzeile', { hasText: text }); return z.locator('textarea').inputValue(); };
pruef('Allianz-Anschrift im Empfänger', (await empf('Allianz')).includes('Allianz Lebensversicherungs-AG'));
pruef('AXA Hausrat mit Sach-Anschrift', (await empf('AXA')) === 'AXA Versicherung AG\n51171 Köln');
pruef('Krankenkasse mit Anschrift', (await empf(tk.name)) === tk.adresse);
pruef('Freie Gesellschaft als Empfängername', (await empf('Kleine Ortsversicherung')) === 'Kleine Ortsversicherung');
pruef('Hinweis des Versicherers sichtbar', await p.locator('.schreibzeile', { hasText: 'Allianz' }).locator('.hilfe', { hasText: 'Sachversicherungen' }).count() === 1);
const vorlage = p.locator('.schreibzeile', { hasText: 'Leere Kündigungsvorlage' }).locator('input[type=checkbox]');
pruef('Leere Vorlage ist zunächst abgewählt', !(await vorlage.isChecked()));
await vorlage.check();
await p.click('button:has-text("Ausgewählte Schreiben drucken")');
const datei = path.join(erg, 'versicherer.pdf');
await p.pdf({ path: datei, preferCSSPageSize: true, printBackground: true });
const text = execFileSync('pdftotext', [datei, '-']).toString().replace(/\s+/g, ' ');
pruef('Brief an Allianz mit Versicherungsnummer', text.includes('10842 Berlin') && text.includes('Versicherungsnummer LV-778899'));
pruef('Lebensversicherung als Meldung', text.includes('Meldung eines Todesfalls, Versicherungsnummer LV-778899'));
pruef('Brief an AXA Köln mit Nummer', text.includes('51171 Köln') && text.includes('Tod der versicherten Person, Versicherungsnummer HR 12-345'));
pruef('Krankenkasse im Brief', text.includes(tk.adresse.split('\n').pop()));
pruef('Leere Vorlage mit Lücken', text.includes('Kündigung wegen Todesfalls') && /_{8,}/.test(text));
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
console.log('Fehler:', fehler);
await browser.close();
