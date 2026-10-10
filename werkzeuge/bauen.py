"""Erzeugt aus start/ und app/ den Ordner docs/ für GitHub Pages (Webseite an der Wurzel, App unter app/) und die Download-Fassung dist/klarordner.html.

Die Übersetzungen aus app/sprachen/ werden dabei in die App eingesetzt."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

wurzel = Path(__file__).resolve().parent.parent
app, docs, dist = wurzel / "app", wurzel / "docs", wurzel / "dist"

# Übersetzungen aus app/sprachen/ in die App einsetzen.
uebersetzungen = {d.stem: json.loads(d.read_text(encoding="utf-8")) for d in sorted((app / "sprachen").glob("[a-z][a-z].json"))}
quelle = (app / "klarordner.html").read_text(encoding="utf-8")
marke = "/*UEBERSETZUNGEN*/{}"
assert marke in quelle, "Marke für Übersetzungen fehlt"
fertig = quelle.replace(marke, json.dumps(uebersetzungen, ensure_ascii=False, separators=(",", ":")))
# Anbieter-Steckbriefe für die Schreiben im Todesfall.
anbieter = json.loads((app / "anbieter.json").read_text(encoding="utf-8"))
assert "/*ANBIETER*/[]" in fertig, "Marke für Anbieter fehlt"
fertig = fertig.replace("/*ANBIETER*/[]", json.dumps(anbieter, ensure_ascii=False, separators=(",", ":")))
# Schriften einbetten, damit die App ohne Verbindung nach außen gleich aussieht.
import base64
BEREICH = {"latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
           "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"}
schriften = []
for familie, datei, gewicht in [("Atkinson Hyperlegible", "atkinson-hyperlegible", 400), ("Atkinson Hyperlegible", "atkinson-hyperlegible", 700), ("Fraunces", "fraunces", 600)]:
    for teil, bereich in BEREICH.items():
        daten = base64.b64encode((app / "schriften" / f"{datei}-{teil}-{gewicht}-normal.woff2").read_bytes()).decode()
        schriften.append(f'@font-face{{font-family:"{familie}";font-style:normal;font-weight:{gewicht};font-display:swap;src:url(data:font/woff2;base64,{daten}) format("woff2");unicode-range:{bereich}}}')
assert "/*SCHRIFTEN*/" in fertig, "Marke für Schriften fehlt"
fertig = fertig.replace("/*SCHRIFTEN*/", "\n".join(schriften))
# Texte für die Angehörigen nach der Übergabe. Jeder Schlüssel muss ein Anzeigetext der App sein.
ansprache = json.loads((app / "ansprache.json").read_text(encoding="utf-8"))
assert "/*ANSPRACHE*/const ANGEHOERIGE = {};" in fertig, "Marke für Ansprache fehlt"
fertig = fertig.replace("/*ANSPRACHE*/const ANGEHOERIGE = {};", "const ANGEHOERIGE = " + json.dumps(ansprache, ensure_ascii=False, separators=(",", ":")) + ";")
subprocess.run([sys.executable, str(wurzel / "werkzeuge" / "texte.py")], check=True)
bekannt = set(json.loads((app / "sprachen" / "_texte.json").read_text(encoding="utf-8")))
unbekannt = [k for k in ansprache if k not in bekannt]
assert not unbekannt, f"ansprache.json: kein Anzeigetext: {unbekannt}"

shutil.rmtree(docs, ignore_errors=True)
# Wurzel: die Webseite mit Vormerkung, Checkliste, Impressum und Auswertung. Darunter app/ mit der eigentlichen App.
shutil.copytree(wurzel / "start", docs)
(docs / "schriften").mkdir()
for schrift in (app / "schriften").glob("*.woff2"):
    shutil.copy(schrift, docs / "schriften" / schrift.name)
appziel = docs / "app"
appziel.mkdir()
(appziel / "icons").mkdir()
(appziel / "index.html").write_text(fertig, encoding="utf-8")
shutil.copy(app / "manifest.webmanifest", appziel / "manifest.webmanifest")
for icon in (app / "icons").glob("*.png"):
    shutil.copy(icon, appziel / "icons" / icon.name)
shutil.copytree(app / "ocr", appziel / "ocr")
shutil.copy(app / "schriften" / "LIZENZEN.txt", appziel / "schriften-lizenzen.txt")
ocr = hashlib.sha256()
for datei in sorted((app / "ocr").iterdir()):
    ocr.update(datei.read_bytes())

# Neue Version, sobald sich eine Datei der App ändert, damit installierte Apps das Update laden.
pruef = hashlib.sha256()
for datei in sorted(appziel.rglob("*")):
    if datei.is_file():
        pruef.update(datei.read_bytes())
version = pruef.hexdigest()[:10]
(appziel / "sw.js").write_text((app / "sw.js").read_text(encoding="utf-8").replace("__VERSION__", version).replace("__OCRVERSION__", ocr.hexdigest()[:10]), encoding="utf-8")
# Die App lag früher an der Wurzel. Ein dort noch installierter Service Worker holt sich diese Fassung,
# räumt seine Ablage auf, meldet sich ab und lädt die Seite neu, die dann die Webseite zeigt.
(docs / "sw.js").write_text(f"""// Die App liegt jetzt unter app/. Diese Datei löst eine ältere Installation an der Wurzel ab.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(namen => Promise.all(namen.filter(n => n !== "klarordner-{version}" && n !== "klarordner-ocr-{ocr.hexdigest()[:10]}").map(n => caches.delete(n))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({{ type: "window" }}))
    .then(fenster => fenster.forEach(f => f.navigate(f.url)))));
""", encoding="utf-8")
(docs / ".nojekyll").write_text("")

dist.mkdir(exist_ok=True)
(dist / "klarordner.html").write_text(fertig, encoding="utf-8")
print(f"docs/ und dist/ erzeugt, Version {version}")
