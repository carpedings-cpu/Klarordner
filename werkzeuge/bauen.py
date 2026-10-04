"""Erzeugt aus app/ den Ordner docs/ für GitHub Pages und die Download-Fassung dist/klarordner.html."""
import hashlib
import shutil
from pathlib import Path

wurzel = Path(__file__).resolve().parent.parent
app, docs, dist = wurzel / "app", wurzel / "docs", wurzel / "dist"

shutil.rmtree(docs, ignore_errors=True)
docs.mkdir()
(docs / "icons").mkdir()
shutil.copy(app / "klarordner.html", docs / "index.html")
shutil.copy(app / "manifest.webmanifest", docs / "manifest.webmanifest")
for icon in (app / "icons").glob("*.png"):
    shutil.copy(icon, docs / "icons" / icon.name)

# Neue Version, sobald sich eine Datei ändert, damit installierte Apps das Update laden.
pruef = hashlib.sha256()
for datei in sorted(docs.rglob("*")):
    if datei.is_file():
        pruef.update(datei.read_bytes())
version = pruef.hexdigest()[:10]
(docs / "sw.js").write_text((app / "sw.js").read_text(encoding="utf-8").replace("__VERSION__", version), encoding="utf-8")
(docs / ".nojekyll").write_text("")

dist.mkdir(exist_ok=True)
shutil.copy(app / "klarordner.html", dist / "klarordner.html")
print(f"docs/ und dist/ erzeugt, Version {version}")
