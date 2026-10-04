// Prüft Spracherkennung, Sprachwahl, Umwandlung alter Dateien und vergessene deutsche Texte.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../dist/klarordner.html');
const en = JSON.parse(fs.readFileSync(path.join(hier, '../app/sprachen/en.json'), 'utf8'));
const deutsch = new Set(Object.keys(en).filter(k => en[k] !== k));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ locale: 'en-US', acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const fehler = [];
await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; });
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await p.goto(url);
console.log('Erkannt:', await p.textContent('#btnSprache'), '|', await p.textContent('#btnNeu'));
await p.click('#btnSprache');
console.log('Sprachen im Dialog:', await p.locator('.sprachliste button').count());
await p.click('.sprachliste button:has-text("Deutsch")');
console.log('Nach Wechsel:', await p.textContent('#btnNeu'));
await p.reload();
console.log('Nach Neustart gemerkt:', await p.textContent('#btnNeu'));
await p.click('#btnSprache');
await p.click('.sprachliste button:has-text("English")');

// Alte Datei (Version 1, deutsche Werte) auf Englisch öffnen
await p.setInputFiles('#dateiwahl', path.join(hier, 'testdaten.notfall.json'));
await p.waitForSelector('.kacheln');
console.log('Stand:', await p.textContent('.stand'));
await p.click('#navliste li:nth-child(1) button');
const fs1 = p.locator('#inhalt select').first();
console.log('Familienstand:', await fs1.inputValue(), '/', await fs1.locator('option:checked').textContent());
await p.click('#navliste li:nth-child(3) button');
console.log('Organspende gewählt:', await p.locator('.wahl label:has(input:checked)').first().textContent(), '| Ausweisfeld sichtbar:', await p.isVisible('text=Where is your organ donor card?'));
await p.click('#navliste li:nth-child(4) button');
console.log('Vorsorgevollmacht Details sichtbar:', await p.locator('.bedingt').first().isVisible());
await p.click('#navliste li:nth-child(6) button');
console.log('Versicherung Kopf:', await p.locator('.eintrag h4').first().textContent(), '| Frist-Hinweis:', await p.locator('.bedingt').first().isVisible());

// In jedem Bereich nach deutschen Resten suchen
const reste = new Set();
for (let i = 0; i <= 12; i++) {
  await p.click(i === 0 ? '#navStart button' : `#navliste li:nth-child(${i}) button`);
  const texte = await p.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const out = []; let n;
    while ((n = w.nextNode())) { const s = n.textContent.trim(); if (s && n.parentElement.offsetParent !== null) out.push(s); }
    for (const o of document.querySelectorAll('option, [aria-label]')) out.push((o.textContent || o.getAttribute('aria-label')).trim());
    return out;
  });
  for (const s of texte) if (deutsch.has(s)) reste.add(s);
}
console.log('Deutsche Reste in der englischen Oberfläche:', [...reste]);

// Gespeicherte Datei ist Version 2 mit neutralen Schlüsseln
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnSpeichern')]);
const d = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
console.log('Dateiname:', dl.suggestedFilename(), '| Version:', d.schemaVersion, '| Werte:', d.persoenlich.familienstand, d.gesundheit.organspende, d.vollmachten.vorsorgevollmacht.vorhanden, d.versicherungen[0].art, d.wohnen.wohnform, d.digital.konten[0].wunsch, d.sterbefall.bestattungsart);
console.log('Fehler:', fehler);
await browser.close();
