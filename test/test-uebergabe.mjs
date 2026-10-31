import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../app/klarordner.html', import.meta.url),'utf8');
const built = fs.readFileSync(new URL('../docs/app/index.html', import.meta.url),'utf8');
function fn(name, html=source) { const start=html.indexOf('function '+name+'('); assert.ok(start>=0,name);return html.slice(start,html.indexOf('\n}',start)+2); }
class Node {
  constructor(tag,attrs,kids) {this.tag=tag;this.attrs=attrs;this.children=kids.flat().filter(x=>x!=null);this.handlers={};this.value=attrs.value||'';for(const [key,value] of Object.entries(attrs))if(key.startsWith('on'))this.addEventListener(key.slice(2),value);}
  addEventListener(type,callback){(this.handlers[type] ||= []).push(callback);}
  dispatchEvent(e){for(const cb of this.handlers[e.type]||[])cb(e);}
  setAttribute(k,v){this.attrs[k]=v;}
}
const c={console,structuredClone,Event,FORMAT:'test',SCHEMA_VERSION:5,MIGRATIONEN:{},zustand:{ansicht:'uebersicht'},tresor:{},fuerAngehoerige:false,druck:false,
  voll:v=>typeof v==='string'?v.trim()!==''&&v!=='weissNicht':!!v,
  t:(s,p={})=>String(s).replace(/\{(\w+)\}/g,(_,k)=>p[k]??k),
  el:(tag,attrs={},...kids)=>new Node(tag,attrs,kids),neueId:(()=>{let i=0;return()=>String(++i)})(),
  speichernVormerken(){},statusZeigen(){},tresorGeaendert(){},kurzuebersichtDrucken(){},pdfFuerAngehoerige(){},wechseln(){},datumText:d=>d||'unbekannt',
  gruppe:(title,help,...kids)=>new Node('section',{title},kids),
  OPTIONEN:{},BEREICHE:[],aktualitaetsKarte:()=>null,hinweis:text=>new Node('p',{text},[])
};
vm.createContext(c);
for(const name of ['leereDaten','istObjekt','ergaenzen','einlesen','wurzel','pfadLesen','pfadSchreiben','aenderung','geaendert','offenOrt','offenInfo','offenText','offenWahl','suchHinweis','suchAufgaben','inhaltStand','uebergabeStatus','naechsteSchritte','sicherungsText','pruefvermerkSetzen','kopieBestaetigen','angehoerigenInhalt','angehoerigeAnsicht','feld','uebergabeAnsicht','uebersicht','schreibenPruefpunkte','schreibenStatusText']){
 assert.equal(fn(name),fn(name,built),'build parity '+name);vm.runInContext(fn(name),c);
}
const walk=(n,test)=> n instanceof Node ? (test(n)?[n]:[]).concat(n.children.flatMap(k=>walk(k,test))) : [];
const old=c.leereDaten();delete old.uebergabe;delete old.inhaltStand;old.lastModified='2026-01-01T10:00:00.000Z';old.persoenlich.vorname='Erika';old.persoenlich.nachname='Muster';old.finanzen.konten=[{bank:'Musterbank',iban:'DE-TEST'}];
c.zustand.daten=c.einlesen(JSON.stringify(old));
assert.equal(c.zustand.daten.persoenlich.vorname,'Erika');
assert.equal(c.zustand.daten.finanzen.konten[0].iban,'DE-TEST');
assert.equal(c.uebergabeStatus().sicher,false);
assert.equal(c.pruefvermerkSetzen(),false);
assert.equal(c.kopieBestaetigen(),false);
const contentStamp=c.inhaltStand();
c.pfadSchreiben('uebergabe.ablage','Papierkopie im Schrank der Tochter');
assert.equal(c.inhaltStand(),contentStamp,'metadata preserves content version');
assert.equal(c.uebergabeStatus().sicher,false,'entering a place is not a confirmed copy');
assert.equal(c.kopieBestaetigen(),true);
assert.equal(c.uebergabeStatus().sicher,true);
c.pfadSchreiben('uebergabe.person','Testperson');
for(const key of ['erhalten','geoeffnet','gefunden','rueckfragen'])c.pfadSchreiben('uebergabe.'+key,true);
assert.equal(c.pruefvermerkSetzen(),true);
assert.equal(c.uebergabeStatus().pruefung,true);
c.pfadSchreiben('uebergabe.notizen','Probelauf auf Papier.');
assert.equal(c.uebergabeStatus().pruefung,true,'notes do not masquerade as content edits');
const roundtrip=c.einlesen(JSON.stringify(c.zustand.daten));c.zustand.daten=roundtrip;
assert.equal(c.uebergabeStatus().sicher,true);
assert.equal(c.uebergabeStatus().pruefung,true);
c.pfadSchreiben('persoenlich.ablageUrkunden','Anderer Schrank');
assert.notEqual(c.inhaltStand(),contentStamp);
assert.equal(c.uebergabeStatus().sicher,false,'changed contents invalidate copy confirmation');
assert.equal(c.uebergabeStatus().pruefung,false,'changed contents invalidate handover confirmation');
assert.equal(c.uebergabeStatus().alt,true);
assert.equal(c.zustand.daten.uebergabe.gefunden,false,'repeat trial requires fresh answers');
assert.equal(c.pruefvermerkSetzen(),false);
// Relatives read a useful overview, never the credential vault or private message.
c.zustand.daten.zugang={verschluesselt:'SECRET-CREDENTIALS'};
c.zustand.daten.nachricht.text='PRIVATE-MESSAGE';
c.zustand.daten.kontakte=[{name:'Testkontakt',telefon:'000-TEST'}];
const reading=new Node('div',{},c.angehoerigeAnsicht());
assert.equal(walk(reading,n=>['input','textarea','select'].includes(n.tag)).length,0);
const serialized=JSON.stringify(reading);
assert.ok(serialized.includes('Testkontakt'));
assert.ok(serialized.includes('Anderer Schrank'));
assert.ok(!serialized.includes('SECRET-CREDENTIALS'));
assert.ok(!serialized.includes('PRIVATE-MESSAGE'));
// The overview uses one next-step card, without the portrait or the old competing start.
const overview=new Node('div',{},c.uebersicht());
assert.ok(!JSON.stringify(overview).includes('Foto auswählen'));
assert.ok(!JSON.stringify(overview).includes('Mit dem Ausfüllen beginnen'));
assert.equal(walk(overview,n=>n.attrs.class==='formkarte naechster-schritt').length,1);
// Missing information is suggested even without manually marking a field.
c.zustand.daten=c.leereDaten();
assert.equal(c.naechsteSchritte().length,3);
assert.equal(c.naechsteSchritte()[0].ziel,'einstieg');
assert.equal(c.offenWahl('persoenlich.vorname','Vorname',new Node('input',{},[])),null);
assert.equal(c.offenWahl('uebergabe.person','Person',new Node('input',{},[])),null);
assert.equal(c.offenWahl('persoenlich.steuerId','Steuer-ID',new Node('input',{},[])).tag,'details');
// Legacy unknown answers remain visible after the redesign.
c.zustand.daten.testament.testament.vorhanden='weissNicht';
assert.ok(c.suchAufgaben().some(a=>a.pfad==='testament.testament.vorhanden'));
// A template never receives an unqualified 'ready to send' status.
assert.ok(c.schreibenPruefpunkte({id:'x',art:'leer',adresse:''}).includes('Absendername'));
assert.match(c.schreibenStatusText({id:'x',art:'leer',adresse:''}),/Noch zu ergänzen/);
const handover = new Node('div',{},c.uebergabeAnsicht());
assert.equal(walk(handover,n=>n.tag==='input'&&n.attrs.type==='checkbox').length,4);
assert.equal(walk(handover,n=>n.tag==='select').length,0,'handover fields have no unnecessary unknown dropdowns');
console.log('OK: alte/neue Dateien, Versionsbindung, echte Bestätigungen, erneuter Probelauf, Datenerhalt, Leseansicht ohne Geheimnisse, kompakter Einstieg, offene Aufgaben und Schreibstatus.');
