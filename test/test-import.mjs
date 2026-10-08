// Prüft den Import aus der Kontakte-App (vCard) und aus Passwort-Exporten (CSV).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const dat = n => path.join(hier, 'import', n);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const p = await (await browser.newContext({ locale: 'de-DE', viewport: { width: 1280, height: 900 } })).newPage();
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await p.goto(url);
await p.click('#btnNeu');
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);

// Kontakte
await p.click('#navliste button[data-id=kontakte]');
await p.evaluate(() => { document.getElementById('vcfwahl').value = ''; });
await p.setInputFiles('#vcfwahl', dat('kontakte.vcf'));
await p.waitForSelector('dialog[open]');
console.log('Meldung:', (await p.textContent('#dialogText')).slice(0, 70));
await p.click('dialog button:has-text("Verstanden")');
const k = await p.evaluate(() => zustand.daten.kontakte);
pruef('4 Kontakte', k.length === 4);
pruef('vCard 3.0 Telefon und E-Mail', k[0].name === 'Thomas Musterfrau' && k[0].telefon === '01234 000001' && k[0].email === 'thomas@example.org');
pruef('Handy mit item-Präfix, Anschrift', k[1].mobil === '+49 170 0000002' && k[1].anschrift === 'Lindenweg 6, 12345 Beispielstadt');
pruef('vCard 2.1 Quoted-Printable mit Umlauten', k[2].name === 'Jürgen Müller' && k[2].mobil === '0171 1234567' && k[2].telefon === '0661 999');
pruef('Gefaltete QP-Zeile in der Anschrift', k[2].anschrift === 'Gartenstraße 1, 36037 Fulda');
pruef('vCard 4.0 tel-URI', k[3].telefon === '+49-661-555' && k[3].name === 'Pfarramt St. Maria');
console.log('Einträge in der Liste:', await p.locator('.eintrag h4').allTextContents());
await p.evaluate(() => { document.getElementById('vcfwahl').value = ''; });
await p.setInputFiles('#vcfwahl', dat('kontakte.vcf'));
await p.waitForSelector('dialog[open]');
pruef('Zweiter Import ohne Doppelte', (await p.textContent('#dialogText')).includes('0 von 4') && (await p.evaluate(() => zustand.daten.kontakte.length)) === 4);
await p.click('dialog button:has-text("Verstanden")');

// Passwörter: nur im entsperrten Bereich
await p.click('#navliste button[data-id=digital]');
console.log('Import-Knopf gesperrt nicht sichtbar:', !(await p.isVisible('button:has-text("Passwort-Datei auswählen")')));
await p.locator('#inhalt input[type=password]').nth(0).fill('Mein Hund heisst Bello');
await p.locator('#inhalt input[type=password]').nth(1).fill('Mein Hund heisst Bello');
await p.check('.bestaetigung input');
await p.click('button:has-text("Zugangsdaten schützen")');
await p.waitForSelector('text=Jetzt sperren');
await p.evaluate(() => { document.getElementById('csvwahl').value = ''; });
await p.setInputFiles('#csvwahl', dat('chrome.csv'));
await p.waitForSelector('dialog[open]');
console.log('Vorschau Chrome:', (await p.textContent('#dialogText')));
await p.click('dialog button:has-text("Übernehmen")');
await p.waitForSelector('dialog[open] >> text=Bitte löschen Sie jetzt die Exportdatei');
pruef('Lösch-Aufforderung', true);
await p.click('dialog button:has-text("Verstanden")');
for (const f of ['firefox.csv', 'apple.csv']) {
  await p.evaluate(() => { document.getElementById('csvwahl').value = ''; });
await p.setInputFiles('#csvwahl', dat(f));
  await p.waitForSelector('dialog[open]');
  console.log(`Vorschau ${f}:`, (await p.textContent('#dialogText')));
  await p.click('dialog button:has-text("Übernehmen")');
  await p.click('dialog button:has-text("Verstanden")');
}
const z = await p.evaluate(() => tresor.inhalt.eintraege.map(e => `${e.bezeichnung}|${e.benutzer}|${e.passwort}|${e.art}`));
console.log('Zugangsdaten:', z);
pruef('Komma und Anführungszeichen im Passwort', z.some(e => e.includes('pa,ss"wort')));
pruef('Sparkasse und DKB ausgelassen', !z.some(e => /sparkasse|dkb/i.test(e)));
pruef('Netflix nur einmal', z.filter(e => e.startsWith('Netflix|')).length === 1 && !z.some(e => e.startsWith('netflix.com|')));
pruef('App-Zugang lesbar', z.some(e => e.startsWith('whatsapp.com|')));
pruef('Mehrzeilige Notiz', await p.evaluate(() => tresor.inhalt.eintraege.some(e => e.notiz === 'Zeile1\nZeile2')));
const dg = await p.evaluate(() => zustand.daten.digital.konten.map(k => `${k.anbieter}|${k.benutzername}|${k.kategorie}`));
console.log('Digitaler Nachlass:', dg);
pruef('Bekannte Anbieter im Nachlass, ohne Forum', dg.some(e => e.startsWith('Netflix|')) && dg.some(e => e.startsWith('Amazon|')) && dg.some(e => e.startsWith('PayPal|')) && dg.some(e => e.startsWith('GMX|')) && dg.some(e => e.startsWith('Facebook|')) && !dg.some(e => /garten/i.test(e)));
pruef('Kein Passwort im Nachlass', !(await p.evaluate(() => JSON.stringify(zustand.daten.digital))).includes('N3tfl1x'));
await p.waitForTimeout(1500);
const geraet = await p.evaluate(() => new Promise(ok => { const r = indexedDB.open('klarordner'); r.onsuccess = () => { const g = r.result.transaction('ordner').objectStore('ordner').get('aktuell'); g.onsuccess = () => ok(JSON.stringify(g.result)); }; }));
pruef('Kein Passwort im Klartext auf dem Gerät', !geraet.includes('N3tfl1x') && !geraet.includes('blume42') && geraet.includes('"zugang":{'));
// Falsche Datei
await p.evaluate(() => { document.getElementById('csvwahl').value = ''; });
await p.setInputFiles('#csvwahl', dat('kontakte.vcf'));
await p.waitForSelector('dialog[open]');
console.log('Falsche Datei:', await p.textContent('#dialogTitel'));
console.log('Fehler:', fehler);
await browser.close();
