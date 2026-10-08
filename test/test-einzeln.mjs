// Prüft das Öffnen einzelner Schreiben: Brief mit Vorschau und Druck, E-Mail mit fertigem Text, Webseite bei Online-Verfahren.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const spaeter = async (s) => { const d = s.locator('dialog[open]'); await d.waitFor({ timeout: 3000 }).catch(() => {}); if (await d.isVisible()) await s.click('dialog[open] #dialogKnoepfe button:last-child'); };
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const p = await (await browser.newContext({ locale: 'de-DE', viewport: { width: 1180, height: 900 } })).newPage();
await p.addInitScript(() => {
  delete window.showOpenFilePicker; delete window.showSaveFilePicker;
  window.print = () => { window.__gedruckt = (window.__gedruckt || 0) + 1; };
  const klick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.href.startsWith('mailto:')) { window.__mail = this.href; return; } return klick.call(this); };
});
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await p.goto(url);
await p.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
await spaeter(p);
await p.evaluate(() => {
  zustand.daten.vertraege.find(v => v.anbieter === 'Beispiel-Streaming').kuendigung = 'Per Mail an kuendigung@beispiel-streaming.de';
  zustand.daten.vertraege.push({ art: 'telefon', anbieter: 'Telekom', vertragsnummer: 'K-4711', zaehler: '', kosten: '', kuendigung: '', notiz: '' });
  zustand.daten.vertraege.push({ art: 'streaming', anbieter: 'Netflix', vertragsnummer: '', zaehler: '', kosten: '', kuendigung: '', notiz: '' });
  zustand.daten.versicherungen.push({ art: 'leben', gesellschaft: 'Allianz', vertragsnummer: 'LV-1234', beguenstigt: '', ablage: '', notiz: '' });
  inhaltZeigen();
});
pruef('Keine Kündigungskarte auf der Übersicht', !(await p.isVisible('.formkarte.kuendigung')));
pruef('Eigener Punkt in der Seitenleiste', await p.isVisible('#navExtra button[data-id=schreiben]'));
await p.click('#navliste button[data-id=vertraege]');
pruef('Karte im Bereich Verträge', await p.isVisible('.bereichinhalt .formkarte.kuendigung'));
await p.click('.bereichinhalt .formkarte.kuendigung button');
pruef('Zurück führt zu den Verträgen', (await p.textContent('.zurueck-oben')).includes('Verträge'));

const zeile = name => p.locator('.schreibzeile', { has: p.locator('strong', { hasText: name }) });
// Fehlende Absenderangaben
await zeile('Telekom').locator('button:has-text("Brief öffnen")').click();
pruef('Hinweis auf fehlende Angaben', (await p.textContent('#dialogTitel')) === 'Es fehlen noch Angaben');
await p.click('dialog button:has-text("Angaben eintragen")');
await p.fill('#inhalt input >> nth=0', 'Thomas Musterfrau');
await p.fill('#inhalt input >> nth=1', 'Sohn und Erbe');
await p.fill('#inhalt textarea >> nth=0', 'Am Markt 1\n12345 Beispielstadt');
await p.fill('#inhalt input[type=date]', '2026-09-20');

// Brief öffnen: Vorschau, dann nur dieser Brief im Druck
await zeile('Telekom').locator('button:has-text("Brief öffnen")').click();
const vorschau = await p.textContent('.briefvorschau');
pruef('Vorschau mit Empfänger, Betreff und Sterbesatz', vorschau.includes('53171 Bonn') && vorschau.includes('Kunden- oder Vertragsnummer K-4711') && vorschau.includes('ist am 20.09.2026 verstorben') && vorschau.includes('Thomas Musterfrau'));
await p.click('dialog button:has-text("Drucken oder als PDF sichern")');
const druck = await p.evaluate(() => ({ n: window.__gedruckt, briefe: document.querySelectorAll('#druck .dbrief:not(.danleitung)').length, text: document.querySelector('#druck').textContent }));
pruef('Nur dieser Brief im Druck', druck.n === 1 && druck.briefe === 1 && druck.text.includes('53171 Bonn') && !druck.text.includes('Beitragsservice'));
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

// E-Mail: Adresse aus „Wie wird gekündigt?“
const streaming = zeile('Beispiel-Streaming');
pruef('Kennzeichnung „auch per E-Mail“', (await streaming.locator('.schreibart').textContent()).includes('auch per E-Mail'));
await streaming.locator('button:has-text("E-Mail öffnen")').click();
pruef('Hinweis auf Anhang', (await p.textContent('#dialogText')).includes('Kopie der Sterbeurkunde an'));
await p.click('dialog button:has-text("Mail-App öffnen")');
const mail = await p.evaluate(() => window.__mail || '');
const [ziel, query] = mail.slice(7).split('?');
const parameter = new URLSearchParams(query.replace(/\+/g, '%2B'));
const betreff = parameter.get('subject') || '', text = parameter.get('body') || '';
console.log('  Mail an:', ziel, '| Betreff:', betreff);
pruef('Mail an die notierte Adresse', ziel === 'kuendigung@beispiel-streaming.de');
pruef('Betreff mit Kündigung', betreff.startsWith('Kündigung wegen Todesfalls'));
pruef('Text vollständig', text.startsWith('Sehr geehrte Damen und Herren,') && text.includes('ist am 20.09.2026 verstorben') && text.includes('Mit freundlichen Grüßen\nThomas Musterfrau\nAm Markt 1\n12345 Beispielstadt') && text.includes('Anlage: Kopie der Sterbeurkunde'));
pruef('Mail auf Deutsch', !/Dear|death certificate/.test(text));

// Hinterlegte Adresse eines Versicherers
await zeile('Allianz').locator('button:has-text("E-Mail öffnen")').click();
await p.click('dialog button:has-text("Mail-App öffnen")');
const mail2 = await p.evaluate(() => window.__mail);
pruef('Allianz: Mail an hinterlegte Adresse mit Versicherungsnummer', mail2.startsWith('mailto:lebensversicherung@allianz.de?') && decodeURIComponent(mail2).includes('Versicherungsnummer LV-1234'));

// Ohne bekannte Adresse: Mail-App mit leerem Empfänger, eigene Adresse eintragen
const bank = zeile('Beispielbank');
pruef('Bank: E-Mail-Knopf auch ohne Adresse', await bank.locator('button:has-text("E-Mail öffnen")').count() === 1);
await bank.locator('button:has-text("E-Mail öffnen")').click();
pruef('Hinweis zum Eintragen der Adresse', (await p.textContent('#dialogText')).includes('bei „An“'));
await p.click('dialog button:has-text("Mail-App öffnen")');
pruef('Mail ohne Empfänger geöffnet', (await p.evaluate(() => window.__mail)).startsWith('mailto:?subject='));
await bank.locator('summary').click();
await bank.locator('input[type=email]').fill('nachlass@beispielbank.de');
await zeile('Beispielbank').locator('button:has-text("E-Mail öffnen")').click();
await p.click('dialog button:has-text("Mail-App öffnen")');
pruef('Eigene Adresse wird verwendet und gespeichert', (await p.evaluate(() => window.__mail)).startsWith('mailto:nachlass@beispielbank.de?') && await p.evaluate(() => zustand.daten.schreiben.email['bank:Beispielbank'] === 'nachlass@beispielbank.de'));

// Online-Verfahren: Webseite des Anbieters
const netflix = zeile('Netflix');
const link = netflix.locator('a:has-text("Webseite öffnen")');
pruef('Netflix: Webseite in neuem Fenster', (await link.getAttribute('href')).startsWith('https://') && await link.getAttribute('target') === '_blank');
pruef('Netflix: kein Brief', await netflix.locator('button:has-text("Brief öffnen")').count() === 0);
pruef('Leere Vorlage hat keinen Mail-Knopf', await zeile('Leere Kündigungsvorlage').locator('button:has-text("E-Mail öffnen")').count() === 0);
console.log('Fehler:', fehler);
await browser.close();
