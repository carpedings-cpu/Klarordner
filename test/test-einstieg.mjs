// Ohne Browser ausführbare Regressionen für offene Angaben und den sanften Einstieg.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../app/klarordner.html', import.meta.url), 'utf8');
const built = fs.readFileSync(new URL('../docs/app/index.html', import.meta.url), 'utf8');
for (const html of [source, built]) new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
function fn(name, html = source) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  return html.slice(start, html.indexOf('\n}', start) + 2);
}
class Node {
  constructor(tag, attrs, kids) { this.tag = tag; this.attrs = attrs; this.children = kids.flat().filter(x => x != null); this.handlers = {}; this.value = attrs.value || ''; this.disabled = false; this.dataset = {}; for (const [k,v] of Object.entries(attrs)) if(k.startsWith('on')) this.addEventListener(k.slice(2),v); }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  dispatchEvent(e) { for(const f of this.handlers[e.type] || []) f(e); }
  setAttribute(k,v) { this.attrs[k] = v; }
}
const ctx = { console, structuredClone, Event, FORMAT: 'test', SCHEMA_VERSION: 5, MIGRATIONEN: {}, zustand: {}, tresor: {}, fuerAngehoerige: false, druck: false,
  voll: v => typeof v === 'string' ? v.trim() !== '' && v !== 'weissNicht' : !!v,
  t: (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_,k) => vars[k] ?? k),
  el: (tag, attrs = {}, ...kids) => new Node(tag, attrs, kids),
  neueId: (() => { let i = 0; return () => 'id' + ++i; })(),
  geaendert: () => {}, aenderung: () => {},
  OPTIONEN: { jaNein: { ja: 'Ja', nein: 'Nein' } },
  normWert: v => v, kasten: v => v ? 'yes' : 'no',
  gruppe: (title, help, ...kids) => new Node('section', {title}, kids),
};
vm.createContext(ctx);
const names = ['leereDaten','istObjekt','ergaenzen','einlesen','wurzel','pfadLesen','pfadSchreiben','offenOrt','offenInfo','offenText','offenWahl','suchHinweis','suchAufgaben','einstiegAnsicht','druckWert','druckFeld','feld','wahl'];
for (const name of names) { assert.equal(fn(name), fn(name, built), 'Quell-/Auslieferungsfunktion ' + name); vm.runInContext(fn(name), ctx); }
ctx.zustand.daten = ctx.leereDaten();
const find = (n, tag) => n instanceof Node ? n.tag === tag ? n : n.children.map(k => find(k,tag)).find(Boolean) : null;
function mark(path, label, value = 'unbekannt') {
 const input = new Node('input',{},[]); const control = ctx.offenWahl(path,label,input); const select = find(control,'select'); select.value = value; select.dispatchEvent(new Event('change')); return select;
}
mark('persoenlich.steuerId','Steuer-Identifikationsnummer');
assert.equal(ctx.zustand.daten.persoenlich.steuerId, '');
assert.equal(ctx.suchAufgaben().length, 1);
assert.match(ctx.suchAufgaben()[0].text, /Steuerbescheid/);
const saved = JSON.stringify(ctx.zustand.daten);
ctx.zustand.daten = ctx.einlesen(saved);
assert.equal(ctx.offenInfo('persoenlich.steuerId').grund, 'unbekannt');
ctx.pfadSchreiben('persoenlich.steuerId','12345678901');
assert.equal(ctx.suchAufgaben().length, 0);
assert.equal(ctx.offenInfo('persoenlich.steuerId'), undefined);
// Alte Dateien ohne Metadaten bleiben unverändert lesbar.
const old = ctx.leereDaten(); old.persoenlich.vorname = 'Erika';
ctx.zustand.daten = ctx.einlesen(JSON.stringify(old));
assert.equal(ctx.zustand.daten.persoenlich.vorname, 'Erika');
// Metadaten reisen mit dem Listeneintrag, nicht mit dessen Index.
ctx.zustand.daten.versicherungen = [{gesellschaft:'A',vertragsnummer:''},{gesellschaft:'B',vertragsnummer:''}];
mark('versicherungen.1.vertragsnummer','Versicherungsnummer','spaeter');
ctx.zustand.daten.versicherungen.splice(0,1);
assert.equal(ctx.suchAufgaben()[0].pfad,'versicherungen.0.vertragsnummer');
assert.match(ctx.suchAufgaben()[0].titel,/B/);
ctx.zustand.daten.versicherungen.splice(0,1);
assert.equal(ctx.suchAufgaben().length,0);
// Bestehende Angaben können nicht durch einen Offen-Status überschrieben werden.
ctx.pfadSchreiben('persoenlich.nachname','Muster');
mark('persoenlich.nachname','Nachname');
assert.equal(ctx.offenInfo('persoenlich.nachname'),undefined);
assert.equal(ctx.zustand.daten.persoenlich.nachname,'Muster');
assert.equal(ctx.offenWahl('tresor.0.passwort','Passwort', new Node('input',{},[])),null);
// Tatsächlicher Formularbaustein: unbekannt wählen, eintippen, Status verschwindet.
const field = ctx.feld('persoenlich.ablageUrkunden','Urkunden');
const select = find(field,'select'); select.value='unbekannt'; select.dispatchEvent(new Event('change'));
const input = find(field,'input'); input.value='Schrank links'; input.dispatchEvent(new Event('input'));
assert.equal(ctx.zustand.daten.persoenlich.ablageUrkunden,'Schrank links');
assert.equal(select.disabled,true);
assert.equal(ctx.suchAufgaben().length,0);
// Ja/Nein: unbekannt darf keine Ja/Nein-Antwort vortäuschen.
const choice = ctx.wahl('testament.testament.vorhanden','Testament?','jaNein');
const status = find(choice,'select'); status.value='unbekannt'; status.dispatchEvent(new Event('change'));
assert.equal(ctx.zustand.daten.testament.testament.vorhanden,'');
const radio = find(choice,'input'); radio.dispatchEvent(new Event('change'));
assert.equal(ctx.zustand.daten.testament.testament.vorhanden,'ja');
assert.equal(status.disabled,true);
assert.equal(ctx.offenInfo('testament.testament.vorhanden'),undefined);
// Drucken zeigt offene Angaben als offen, nicht als vermeintliche Daten.
mark('persoenlich.steuerId','Steuer-ID');
const printed = ctx.druckFeld('persoenlich.steuerId','Steuer-ID',{});
assert.match(JSON.stringify(printed),/Noch unbekannt/);
// Bloßes Öffnen des Einstiegs erzeugt keine leeren Kontakte oder Konten.
const before = JSON.stringify(ctx.zustand.daten);
ctx.einstiegAnsicht();
assert.equal(JSON.stringify(ctx.zustand.daten),before);
ctx.zustand.daten.testament.testament.vorhanden = 'weissNicht';
assert.ok(ctx.suchAufgaben().some(a => a.pfad === 'testament.testament.vorhanden'));
assert.equal(ctx.offenInfo('testament.testament.vorhanden').grund, 'unbekannt');
vm.runInContext(source.slice(source.indexOf('const PRUEFUNG ='), source.indexOf('function fortschritt(')), ctx);
ctx.zustand.daten.finanzen.konten = [{bank:''}];
assert.equal(vm.runInContext('PRUEFUNG.finanzen(zustand.daten)[0]', ctx), false);
ctx.zustand.daten.finanzen.konten[0].bank = 'Musterbank';
assert.equal(vm.runInContext('PRUEFUNG.finanzen(zustand.daten)[0]', ctx), true);
console.log('OK: Syntax, Quell-/Auslieferungsfunktionen, alte Dateien, Export/Import, Datenerhalt, Listeneinträge, Eingabefelder, Ja/Nein, Druck und Einstieg.');
