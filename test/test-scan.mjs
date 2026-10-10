// Prüft das Übernehmen von Angaben aus fotografierten Dokumenten. Die Dokumente sind erfunden und werden hier erzeugt.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const erg = path.join(hier, 'ergebnisse');
const server = spawn('python3', ['-m', 'http.server', '8125', '--bind', '127.0.0.1'], { cwd: path.join(hier, '../docs'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [], fremd = [];

const DOKUMENTE = {
  versicherung: `<p style="font-size:30px;font-weight:bold">Allianz Versicherungs-AG</p><p>10900 Berlin</p><br><br>
    <p style="font-size:26px;font-weight:bold">Versicherungsschein</p><p>Private Haftpflichtversicherung</p>
    <p>Versicherungsnummer: AS-9 123 456/7</p><p>Versicherungsnehmerin: Erika Musterfrau</p><p>Beginn: 01.01.2020, Beitrag jährlich 64,80 Euro</p>`,
  strom: `<p style="font-size:30px;font-weight:bold">Stadtwerke Beispielstadt GmbH</p><p>Jahresabrechnung Strom 2025</p><br>
    <p>Kundennummer: 4711 0815</p><p>Zählernummer: 1ESY1160123456</p><p>Lieferstelle: Lindenweg 4, 12345 Beispielstadt</p><p>Verbrauch: 2.140 kWh</p>`,
  konto: `<p style="font-size:30px;font-weight:bold">Sparkasse Beispielstadt</p><p>Kontoauszug 9/2026</p><br>
    <p>Girokonto</p><p>IBAN: DE89 3704 0044 0532 0130 00</p><p>Kontoinhaberin: Erika Musterfrau</p><p>Neuer Kontostand: 1.234,56 EUR</p>`,
  kasse: `<p style="font-size:30px;font-weight:bold">Techniker Krankenkasse</p><p>20910 Hamburg</p><br>
    <p>Ihre Mitgliedsbescheinigung</p><p>Versichertennummer: A123456789</p><p>Frau Erika Musterfrau ist seit 01.04.1990 Mitglied.</p>`,
  steuer: `<p style="font-size:30px;font-weight:bold">Finanzamt Beispielstadt</p><br>
    <p>Bescheid für 2025 über Einkommensteuer</p><p>Steuernummer 12/345/67890</p><p>Identifikationsnummer: 65 929 970 489</p><p>Erika Musterfrau, Lindenweg 4, 12345 Beispielstadt</p>`
};
const bilder = {};
{
  const seite = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  for (const [name, html] of Object.entries(DOKUMENTE)) {
    await seite.setContent(`<body style="margin:0;background:#8a8478"><div style="margin:60px;padding:70px;background:#fbfaf6;font:22px Arial;transform:rotate(-1.5deg);box-shadow:0 0 30px #0006">${html}</div></body>`);
    bilder[name] = path.join(erg, `scan-${name}.jpg`);
    await seite.screenshot({ path: bilder[name], type: 'jpeg', quality: 75 });
  }
  await seite.close();
}

try {
  const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 1180, height: 820 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => fehler.push(e.message));
  p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  ctx.on('request', r => { if (!/^(http:\/\/localhost:8125|data:|blob:)/.test(r.url())) fremd.push(r.url()); });
  await p.goto('http://localhost:8125/app/');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.click('#btnNeu');
  await p.waitForSelector('.kacheln');

  const scannen = async (bereich, bild) => {
    await p.click(`#navliste button[data-id=${bereich}]`);
    const [wahl] = await Promise.all([p.waitForEvent('filechooser'), p.click('button:has-text("Dokument fotografieren")')]);
    await wahl.setFiles(bild);
    await p.locator('#dialogTitel', { hasText: 'Gefundene Angaben prüfen' }).or(p.locator('#dialogTitel', { hasText: 'Keine passenden' })).waitFor({ timeout: 90000 });
    const werte = await p.$$eval('#dialogText .feld', fs => Object.fromEntries(fs.map(f => [f.querySelector('label').textContent, f.querySelector('input,select').value])));
    return werte;
  };
  const start = Date.now();
  let w = await scannen('versicherungen', bilder.versicherung);
  console.log('Versicherungsschein:', JSON.stringify(w), `(${Math.round((Date.now() - start) / 1000)} s inkl. Laden)`);
  pruef('Gesellschaft Allianz erkannt', w['Versicherungsgesellschaft'] === 'Allianz');
  pruef('Art Haftpflicht erkannt', w['Art'] === 'haftpflicht');
  pruef('Versicherungsnummer gelesen', w['Versicherungsnummer'].replace(/\s/g, '') === 'AS-9123456/7');
  await p.click('#dialogKnoepfe button:has-text("Übernehmen")');
  const v = await p.evaluate(() => zustand.daten.versicherungen.at(-1));
  pruef('Eintrag angelegt', v.gesellschaft === 'Allianz' && v.art === 'haftpflicht' && v.vertragsnummer.length > 5);

  w = await scannen('vertraege', bilder.strom);
  console.log('Stromrechnung:', JSON.stringify(w));
  pruef('Strom: Art, Kundennummer, Zählernummer', w['Art'] === 'strom' && w['Vertrags- oder Kundennummer'].replace(/\s/g, '') === '47110815' && w['Zählernummer'] === '1ESY1160123456');
  pruef('Absender als Anbieter vorgeschlagen', w['Anbieter'] === 'Stadtwerke Beispielstadt GmbH');
  await p.click('#dialogKnoepfe button:has-text("Übernehmen")');
  pruef('Vertrag mit Zählernummer angelegt', await p.evaluate(() => zustand.daten.vertraege.at(-1).zaehler) === '1ESY1160123456');

  w = await scannen('finanzen', bilder.konto);
  console.log('Kontoauszug:', JSON.stringify(w));
  pruef('Bank und gültige IBAN', w['Bank'].startsWith('Sparkasse Beispielstadt') && w['IBAN'] === 'DE89 3704 0044 0532 0130 00' && w['Art'] === 'giro');
  await p.click('#dialogKnoepfe button:has-text("Abbrechen")');
  pruef('Abbrechen legt nichts an', await p.evaluate(() => zustand.daten.finanzen.konten.length) === 0);

  w = await scannen('persoenlich', bilder.kasse);
  console.log('Krankenkasse:', JSON.stringify(w));
  pruef('Krankenkasse und Versichertennummer', w['Krankenkasse'] === 'Techniker Krankenkasse' && w['Versichertennummer'] === 'A123456789');
  await p.click('#dialogKnoepfe button:has-text("Übernehmen")');
  w = await scannen('persoenlich', bilder.steuer);
  console.log('Steuerbescheid:', JSON.stringify(w));
  pruef('Steuer-ID aus dem Bescheid', w['Steuer-Identifikationsnummer'] === '65 929 970 489');
  await p.click('#dialogKnoepfe button:has-text("Übernehmen")');
  const pers = await p.evaluate(() => zustand.daten.persoenlich);
  pruef('Persönliche Angaben übernommen', pers.krankenkasse.name === 'Techniker Krankenkasse' && pers.krankenkasse.versichertennummer === 'A123456789' && pers.steuerId === '65 929 970 489');
  pruef('Kein Foto im Ordner gespeichert', !JSON.stringify(await p.evaluate(() => zustand.daten)).includes('data:image'));
  const caches = await p.evaluate(() => caches.keys());
  pruef('Texterkennung für offline abgelegt', caches.some(n => n.startsWith('klarordner-ocr-')));

  // Zweiter Scan ohne Netz aus dem Gerätespeicher
  await p.reload();
  await ctx.setOffline(true);
  await p.reload();
  await p.click('#btnNeu').catch(() => {});
  await p.waitForSelector('.kacheln, #navliste');
  w = await scannen('versicherungen', bilder.versicherung);
  pruef('Scannen funktioniert offline', w['Versicherungsgesellschaft'] === 'Allianz');
  await ctx.setOffline(false);
} finally {
  console.log('Fehler:', fehler, '| Fremde Anfragen:', fremd);
  await browser.close();
  server.kill();
}
