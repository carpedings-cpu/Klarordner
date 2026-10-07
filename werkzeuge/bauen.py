"""Erzeugt aus app/ den Ordner docs/ für GitHub Pages und die Download-Fassung dist/klarordner.html.

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
subprocess.run([sys.executable, str(wurzel / "werkzeuge" / "texte.py")], check=True)

shutil.rmtree(docs, ignore_errors=True)
docs.mkdir()
(docs / "icons").mkdir()
(docs / "index.html").write_text(fertig, encoding="utf-8")
shutil.copy(app / "manifest.webmanifest", docs / "manifest.webmanifest")
for icon in (app / "icons").glob("*.png"):
    shutil.copy(icon, docs / "icons" / icon.name)
shutil.copytree(app / "ocr", docs / "ocr")
ocr = hashlib.sha256()
for datei in sorted((app / "ocr").iterdir()):
    ocr.update(datei.read_bytes())

# Neue Version, sobald sich eine Datei ändert, damit installierte Apps das Update laden.
pruef = hashlib.sha256()
for datei in sorted(docs.rglob("*")):
    if datei.is_file():
        pruef.update(datei.read_bytes())
version = pruef.hexdigest()[:10]
(docs / "sw.js").write_text((app / "sw.js").read_text(encoding="utf-8").replace("__VERSION__", version).replace("__OCRVERSION__", ocr.hexdigest()[:10]), encoding="utf-8")
(docs / ".nojekyll").write_text("")

dist.mkdir(exist_ok=True)
(dist / "klarordner.html").write_text(fertig, encoding="utf-8")
print(f"docs/ und dist/ erzeugt, Version {version}")
