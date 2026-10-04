// Prüft den verschlüsselten Bereich: Anlegen, Klartextfreiheit, neuer IV, Sperren, falsches Passwort, Passwortwechsel.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
const hier = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.join(hier, '../app/klarordner.html');
const PW = 'Mein Hund heisst Bello';
const GEHEIM = 'SuperGeheim-4711';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const neueSeite = async (ctx) => {
  const p = await ctx.newPage();
  await p.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; });
  p.on('pageerror', e => fehler.push(e.message));
  p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  return p;
};
const sichern = async (p) => {
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnSpeichern')]);
  if (await p.waitForSelector('dialog[open]', { timeout: 1500 }).catch(() => null)) await p.click('dialog button:has-text("Verstanden")');
  return fs.readFileSync(await dl.path(), 'utf8');
};
const entschluesseln = async (z, pw) => {
  const b = s => Uint8Array.from(Buffer.from(s, 'base64'));
  const basis = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(z.salt), iterations: z.runden, hash: 'SHA-256' }, basis, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: b(z.iv) }, key, b(z.daten))));
};

const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const p = await neueSeite(ctx);
await p.goto(url);
await p.click('#btnNeu');
await p.click('#navliste li:nth-child(10) button');
const pw1 = p.locator('#inhalt input[type=password]').nth(0), pw2 = p.locator('#inhalt input[type=password]').nth(1);
await pw1.fill('kurz'); await p.click('button:has-text("Zugangsdaten schützen")');
console.log('Zu kurz:', await p.textContent('.fehlertext'));
await pw1.fill(PW); await pw2.fill(PW + 'x'); await p.click('button:has-text("Zugangsdaten schützen")');
console.log('Ungleich:', await p.textContent('.fehlertext'));
await pw2.fill(PW); await p.click('button:has-text("Zugangsdaten schützen")');
console.log('Ohne Haken:', await p.textContent('.fehlertext'));
await p.check('.bestaetigung input');
const t0 = Date.now();
await p.click('button:has-text("Zugangsdaten schützen")');
await p.waitForSelector('text=Jetzt sperren');
console.log('Angelegt in', Date.now() - t0, 'ms');
await p.click('text=+ Zugang hinzufügen');
await p.locator('.eintrag input').nth(0).fill('iPhone');
await p.locator('.eintrag input[type=password]').fill(GEHEIM);
console.log('Passwort verdeckt:', await p.locator('.eintrag input[type=password]').count() === 1);
await p.click('.eintrag button:has-text("Anzeigen")');
console.log('Nach Anzeigen sichtbar:', await p.locator('.eintrag .geheimzeile input').getAttribute('type'));
await p.waitForFunction(() => document.querySelector('#dateistatus').textContent.includes('Auf diesem Gerät'));
const datei1 = await sichern(p);
const datei2 = await sichern(p);
const z1 = JSON.parse(datei1).zugang, z2 = JSON.parse(datei2).zugang;
console.log('Klartext in Datei:', datei1.includes(GEHEIM) || datei1.includes('iPhone'), '| Runden:', z1.runden, '| Salt-Bytes:', Buffer.from(z1.salt, 'base64').length, '| IV-Bytes:', Buffer.from(z1.iv, 'base64').length);
console.log('Neuer IV bei jeder Sicherung:', z1.iv !== z2.iv, '| Salt gleich:', z1.salt === z2.salt);
const inhalt = await entschluesseln(z2, PW);
console.log('Außerhalb der App entschlüsselt:', inhalt.eintraege[0].bezeichnung, inhalt.eintraege[0].passwort === GEHEIM);
const geraet = await p.evaluate(() => new Promise(ok => { const r = indexedDB.open('klarordner'); r.onsuccess = () => { const g = r.result.transaction('ordner').objectStore('ordner').get('aktuell'); g.onsuccess = () => ok(JSON.stringify(g.result)); }; }));
console.log('Klartext im Gerätespeicher:', geraet.includes(GEHEIM) || geraet.includes('iPhone'));

// Neustart: gesperrt, falsches und richtiges Passwort
await p.reload();
await p.click('#navliste li:nth-child(10) button');
console.log('Nach Neustart:', await p.textContent('#inhalt h3'));
await p.fill('#inhalt input[type=password]', 'falsches Passwort');
await p.click('form button:has-text("Öffnen")');
await p.waitForSelector('.fehlertext:not(:empty)');
console.log('Falsch:', await p.textContent('.fehlertext'));
await p.fill('#inhalt input[type=password]', PW);
await p.press('#inhalt input[type=password]', 'Enter');
await p.waitForSelector('text=Jetzt sperren');
console.log('Geöffnet, Eintrag:', await p.locator('.eintrag h4').textContent());

// Passwort ändern
await p.click('button:has-text("Passwort ändern")');
const felder = p.locator('#inhalt form input[type=password]');
await felder.nth(0).fill('falsch falsch'); await felder.nth(1).fill('Neues Passwort 2026'); await felder.nth(2).fill('Neues Passwort 2026');
await p.click('form button:has-text("Passwort ändern")');
await p.waitForSelector('.fehlertext:not(:empty)');
console.log('Altes Passwort falsch:', await p.textContent('.fehlertext'));
await felder.nth(0).fill(PW);
await p.click('form button:has-text("Passwort ändern")');
await p.waitForSelector('dialog[open]');
console.log('Dialog:', await p.textContent('#dialogTitel'));
await p.click('dialog button:has-text("Verstanden")');
await p.click('button:has-text("Jetzt sperren")');
await p.fill('#inhalt input[type=password]', 'Neues Passwort 2026');
await p.click('form button:has-text("Öffnen")');
await p.waitForSelector('text=Jetzt sperren');
console.log('Mit neuem Passwort geöffnet:', await p.locator('.eintrag h4').textContent());

// Automatische Sperre nach 10 Minuten ohne Eingabe
const ctx2 = await browser.newContext({ acceptDownloads: true });
const q = await neueSeite(ctx2);
await q.clock.install();
await q.goto(url);
await q.click('#btnNeu');
await q.click('#navliste li:nth-child(10) button');
await q.locator('#inhalt input[type=password]').nth(0).fill(PW);
await q.locator('#inhalt input[type=password]').nth(1).fill(PW);
await q.check('.bestaetigung input');
await q.click('button:has-text("Zugangsdaten schützen")');
await q.waitForSelector('text=Jetzt sperren');
await q.clock.runFor('09:00');
console.log('Nach 9 Minuten offen:', await q.isVisible('text=Jetzt sperren'));
await q.clock.runFor('01:30');
await q.waitForSelector('text=Die Zugangsdaten sind gesperrt', { timeout: 5000 }).catch(() => {});
console.log('Nach 10,5 Minuten gesperrt:', await q.isVisible('text=Die Zugangsdaten sind gesperrt'));

console.log('Fehler:', fehler);
await browser.close();
