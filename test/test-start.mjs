// Prüft die Landingpage mit Warteliste: Darstellung, Prüfung der Eingaben, Übermittlung, doppelte Adresse, Checkliste.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const erg = path.join(hier, 'ergebnisse');
const server = spawn('python3', ['-m', 'http.server', '8128', '--bind', '127.0.0.1'], { cwd: path.join(hier, '../docs'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const pruef = (was, ja) => console.log(`  ${ja ? 'ok ' : 'FEHLT'} ${was}`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [], anfragen = [];
try {
  const p = await (await browser.newContext({ locale: 'de-DE', viewport: { width: 1280, height: 900 } })).newPage();
  p.on('pageerror', e => fehler.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('status of')) fehler.push(m.text()); });
  p.on('requestfailed', r => { if (!r.url().includes('supabase') && !(r.failure() || {}).errorText.includes('ABORTED')) fehler.push('Laden fehlgeschlagen: ' + r.url()); });
  let antwort = 201;
  await p.route('https://uvvqgwbshdtwlveopgvn.supabase.co/**', route => {
    anfragen.push({ url: route.request().url(), kopf: route.request().headers(), daten: route.request().postDataJSON() });
    route.fulfill({ status: antwort, body: antwort === 201 ? '' : '{"code":"23505"}', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  });
  await p.goto('http://localhost:8128/vormerken/?q=test-anzeige');
  pruef('Landingpage ohne Navigation, mit Link zur Webseite', await p.locator('.navigation').count() === 0 && await p.locator('footer a[href="../"]').count() === 1);
  pruef('Überschrift und Bilder', await p.isVisible('h1') && await p.evaluate(() => [...document.images].every(i => i.loading === 'lazy' || (i.complete && i.naturalWidth > 0))));
  const text = await p.textContent('body');
  pruef('Kostenlos, ohne Preisfragen und ohne Datenschutzversprechen', text.includes('kostenlos') && !/kaufen|Preis|Cloud|bleibt auf Ihrem Gerät/.test(text.replace('Datenschutzhinweise', '')));
  pruef('Schriften geladen', await p.evaluate(() => document.fonts.check('600 20px Fraunces') && document.fonts.check('700 16px "Atkinson Hyperlegible"')));
  await p.screenshot({ path: path.join(erg, 'start-desktop.png'), fullPage: true });
  // Effekte: Bildwechsel im iPad, hochzählende Zahlen, sich füllender Brief
  pruef('Vier Bilder im iPad, erstes aktiv', await p.locator('#schau .folie').count() === 4 && (await p.locator('#schau .folie.aktiv >> nth=0').getAttribute('src')).endsWith('bilder/uebersicht.png'));
  await p.waitForTimeout(4600);
  pruef('Nach vier Sekunden nächstes Bild und neue Karte', (await p.locator('#schau .folie.aktiv').getAttribute('src')).endsWith('bilder/persoenlich.png') && (await p.textContent('#schwebe1 strong')) === 'Eine Frage');
  await p.evaluate(() => document.querySelector('#brief').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(3500);
  pruef('Brief hat alle Felder gefüllt', await p.evaluate(() => { const m = [...document.querySelectorAll('#brief mark')]; return m.length > 5 && m.every(x => x.classList.contains('da')); }));
  pruef('Zahlen hochgezählt', (await p.textContent('#zahlen [data-ziel="74"]')) === '74' && (await p.textContent('#zahlen [data-nach]')) === '20+');
  await p.evaluate(() => window.scrollTo(0, 0));
  // Ohne E-Mail und Einwilligung geht nichts raus
  await p.click('#btnSenden');
  pruef('Fehlende E-Mail wird gemeldet', await p.isVisible('#fehlerEmail') && anfragen.length === 0);
  await p.fill('#email', 'test@beispiel.de');
  await p.click('#btnSenden');
  pruef('Fehlende Einwilligung wird gemeldet', await p.isVisible('#fehlerZustimmung') && !(await p.isVisible('#fehlerEmail')) && anfragen.length === 0);
  await p.click('label:has-text("Für meine Eltern")');
  await p.click('label:has-text("iPad oder Tablet")');
  await p.fill('#nachricht', 'Bitte große Schrift.');
  await p.check('#zustimmung');
  await p.click('#btnSenden');
  await p.waitForSelector('#danke.sichtbar');
  const a = anfragen[0];
  console.log('  Übermittelt:', JSON.stringify(a.daten));
  pruef('Eintrag an die Warteliste geschickt', a.url.endsWith('/rest/v1/klarordner_warteliste') && a.kopf.apikey.startsWith('sb_publishable_') && a.kopf.prefer === 'return=minimal');
  pruef('Alle Antworten enthalten', a.daten.email === 'test@beispiel.de' && a.daten.fuer === 'eltern' && a.daten.geraet === 'ipad' && !('preis' in a.daten) && a.daten.nachricht === 'Bitte große Schrift.' && a.daten.quelle === 'test-anzeige');
  pruef('Dank mit Link zur Checkliste', await p.isVisible('#danke a[href$="checkliste.html"]') && !(await p.isVisible('#formular')));
  // Doppelte Adresse, Aufruf ohne Kennzeichen
  await p.goto('http://localhost:8128/vormerken/');
  antwort = 409;
  await p.fill('#email', 'test@beispiel.de');
  await p.check('#zustimmung');
  await p.click('#btnSenden');
  await p.waitForSelector('#danke.sichtbar');
  pruef('Doppelte Adresse wird freundlich gemeldet', (await p.textContent('#dankeHinweis')).includes('schon eingetragen'));
  pruef('Ohne Quelle kein Kennzeichen', anfragen[1].daten.quelle === null && anfragen[1].daten.fuer === null);
  // Fehler beim Senden
  await p.reload();
  antwort = 500;
  await p.fill('#email', 'test@beispiel.de');
  await p.check('#zustimmung');
  await p.click('#btnSenden');
  await p.waitForSelector('#fehlerSenden.sichtbar');
  pruef('Fehler wird gemeldet, Knopf wieder frei', !(await p.isDisabled('#btnSenden')));
  // Checkliste und Rechtliches
  await p.goto('http://localhost:8128/checkliste.html');
  pruef('Checkliste mit Fristen', (await p.locator('.frist').count()) >= 6 && (await p.textContent('body')).includes('Sterbevierteljahr'));
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: path.join(erg, 'checkliste.pdf'), preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: 'screen' });
  await p.goto('http://localhost:8128/rechtliches.html');
  pruef('Datenschutz nennt Supabase und Widerruf', (await p.textContent('body')).includes('Supabase') && (await p.textContent('body')).includes('widerrufen'));
  // Alle Seiten der Webseite: laden ohne Fehler, Navigation vollständig, aktuelle Seite markiert, Links erreichbar
  for (const seite of ['', 'so-funktioniert-es.html', 'fuer-angehoerige.html', 'fragen.html', 'ueber.html', 'checkliste.html', 'rechtliches.html', 'vormerken/']) {
    await p.goto('http://localhost:8128/' + seite);
    const nav = await p.locator('.navigation a').count();
    const aktuell = await p.locator('.navigation a[aria-current=page]').getAttribute('href').catch(() => null);
    const links = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => !h.startsWith('http') && !h.startsWith('mailto') && !h.startsWith('#')));
    const kaputt = [];
    for (const h of new Set(links)) { const r = await p.request.get(new URL(h.replace(/#.*$/, '') || './', p.url()).href); if (!r.ok()) kaputt.push(h); }
    const bilder = await p.evaluate(() => [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src));
    pruef(`Seite ${seite || 'Start'}: Navigation ${nav} Punkte, aktuell ${aktuell}, Links ok, Bilder ok`, (seite === 'vormerken/' ? nav === 0 : nav === 5) && kaputt.length === 0 && bilder.length === 0 && (seite === 'checkliste.html' || seite === 'rechtliches.html' || seite === 'vormerken/' ? aktuell === null : aktuell === (seite || './')));
    if (kaputt.length) console.log('   kaputt:', kaputt);
  }
  // Auswertungsseite: falsches Passwort, dann nachgestellte Antwort
  await p.unroute('https://uvvqgwbshdtwlveopgvn.supabase.co/**');
  let rpcSchluessel = null;
  await p.route('https://uvvqgwbshdtwlveopgvn.supabase.co/rest/v1/rpc/**', route => {
    rpcSchluessel = route.request().postDataJSON().schluessel;
    if (rpcSchluessel !== 'richtig') return route.fulfill({ status: 403, body: '{"message":"Kein Zugang"}', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      body: JSON.stringify({ gesamt: 12, heute: 2, woche: 9, quelle: [{ wert: 'fb-eltern', n: 7 }, { wert: 'ohne Kennzeichen', n: 5 }], fuer: [{ wert: 'eltern', n: 8 }, { wert: 'mich', n: 4 }], geraet: [{ wert: 'ipad', n: 10 }, { wert: 'keine Angabe', n: 2 }], tage: [{ tag: new Date().toISOString().slice(0, 10), n: 2 }], nachrichten: [{ datum: '2026-10-10', fuer: 'eltern', quelle: 'fb-eltern', text: 'Große Schrift bitte.' }] }) });
  });
  await p.goto('http://localhost:8128/auswertung.html');
  await p.fill('#schluessel', 'falsch');
  await p.click('button:has-text("Anzeigen")');
  await p.waitForSelector('#anmeldeFehler:not([hidden])');
  pruef('Auswertung: falsches Passwort abgelehnt', await p.isHidden('#inhalt'));
  await p.fill('#schluessel', 'richtig');
  await p.click('button:has-text("Anzeigen")');
  await p.waitForSelector('#inhalt:not([hidden])');
  const aus = await p.textContent('#inhalt');
  pruef('Auswertung zeigt Zahlen, Namen und Nachrichten', (await p.textContent('#gesamt')) === '12' && aus.includes('Für meine Eltern') && aus.includes('iPad oder Tablet') && aus.includes('Große Schrift bitte.') && (await p.locator('#tage div').count()) === 30);
  await p.screenshot({ path: path.join(erg, 'start-auswertung.png'), fullPage: true });
  pruef('Auswertung ohne E-Mail-Adressen', !aus.includes('@'));
  // iPad-Ansicht
  const ipad = await (await browser.newContext({ locale: 'de-DE', viewport: { width: 820, height: 1180 }, hasTouch: true })).newPage();
  await ipad.goto('http://localhost:8128/');
  pruef('Kein seitliches Scrollen auf dem iPad', await ipad.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await ipad.screenshot({ path: path.join(erg, 'start-ipad.png'), fullPage: true });
  const handy = await (await browser.newContext({ locale: 'de-DE', viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  await handy.goto('http://localhost:8128/');
  pruef('Kein seitliches Scrollen auf dem Handy', await handy.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await handy.screenshot({ path: path.join(erg, 'start-handy.png'), fullPage: true });
} finally {
  console.log('Fehler:', fehler);
  await browser.close();
  server.kill();
}
