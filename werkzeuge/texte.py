"""Sammelt alle Anzeigetexte der App und prüft die Übersetzungen in app/sprachen/.

Aufruf: python3 werkzeuge/texte.py          Übersicht pro Sprache
        python3 werkzeuge/texte.py en       fehlende Texte für eine Sprache auflisten
"""
import json
import re
import sys
from pathlib import Path

wurzel = Path(__file__).resolve().parent.parent
quelle = wurzel / "app" / "klarordner.html"
sprachordner = wurzel / "app" / "sprachen"

# Literale, die keine Anzeigetexte sind.
TECHNISCH = re.compile(r"""
    ^[a-z][a-zA-Z0-9]*$                 # Bezeichner wie button, persoenlich
  | ^[a-z0-9_.\-]+\.[a-zA-Z0-9_.\-]+$   # Pfade wie persoenlich.vorname, sw.js
  | ^[#.\[:]                            # CSS-Selektoren
  | ^[a-z\-]+(\s[a-z\-]+)*$             # Klassenlisten wie btn primaer
  | ^[A-Z0-9_\-]+$                      # Konstanten und Verfahren wie AES-GCM
  | ^(application|image|data|text)/      # Medientypen
  | ^https?:
  | ^stroke:|^@media\s|^[a-z]+:$|^‹$
  | ^\s+[a-z]+$                        # angehängte Klassen wie " primaer"
  | ^[\s·]+$
  | ^[a-z]+(\s[a-z]+)*\s$|^[a-z]+\.$|^[a-z0-9\-]+/[a-z0-9\-./]+$
  | ^[0-9 ]+$|^2-digit$|^[a-z]{2}-[A-Z]{2}$
""", re.X)
IMMER = {"von", "ledig", "verheiratet", "geschieden", "verwitwet", "beantragt", "unbekannt", "noch nie"}
NIE = {"Klarordner", "2d", "Worker", "ocr/", "Klarordner-Datei", "AbortError", "NotAllowedError", "PBKDF2", "SHA-256", "AES-GCM",
       "AES-GCM-256", "PBKDF2-SHA-256", "Abgebrochen", "SuperGeheim", "IBAN", "WLAN", "Kfz", "E-Mail",
       "1", "2", "3", "4", "5", "0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Depot", "Streaming",
       "Messenger", "Computer", "Deutsch", "English", "Türkçe", "Русский", "Українська", "Polski", "Română",
       "Italiano", "Ελληνικά", "Hrvatski", "Български", "Čeština", "Español", "Français",
       "T12:00:00", "input:checked", "|", ", ", "__andere", "Renten Service der Deutschen Post", "‹ ", "☐", "☒", "KLARORDNER"}


def texte():
    html = quelle.read_text(encoding="utf-8")
    js = html[html.index("<script>"):html.index("</script>")]
    js = js[:js.index("const SYMBOLE")] + js[js.index("const BEREICHE"):]
    # Briefe an deutsche Stellen werden nicht übersetzt.
    if "NUR-DEUTSCH-START" in js:
        js = js[:js.index("/* NUR-DEUTSCH-START")] + js[js.index("/* NUR-DEUTSCH-ENDE */"):]
    # Lesefunktionen für Importe enthalten nur technische Zeichenketten.
    js = re.sub(r"/\* OHNE-TEXTE-START \*/.*?/\* OHNE-TEXTE-ENDE \*/", "", js, flags=re.S)
    funde = set(re.findall(r'data-t="([^"]+)"', html))
    for roh in re.findall(r'"((?:[^"\\\n]|\\.)*)"', js):
        s = roh.encode().decode("unicode_escape").encode("latin-1").decode("utf-8") if "\\" in roh else roh
        if not s.strip() or s in NIE:
            continue
        if s in IMMER or not TECHNISCH.search(s):
            funde.add(s)
    # Optionswerte aus OPTIONEN sind immer Anzeigetexte.
    block = js[js.index("const OPTIONEN"):js.index("// Ältere Dateien")]
    funde.update(v for v in re.findall(r':\s*"([^"]+)"', block) if v not in NIE)
    return sorted(funde)


def main():
    alle = texte()
    (sprachordner / "_texte.json").write_text(json.dumps(alle, ensure_ascii=False, indent=1), encoding="utf-8")
    nur = sys.argv[1] if len(sys.argv) > 1 else None
    print(f"{len(alle)} Anzeigetexte")
    for datei in sorted(sprachordner.glob("[a-z][a-z].json")):
        code = datei.stem
        if nur and code != nur:
            continue
        dic = json.loads(datei.read_text(encoding="utf-8"))
        fehlt = [s for s in alle if s not in dic]
        alt = [s for s in dic if s not in alle]
        print(f"{code}: {len(alle) - len(fehlt)}/{len(alle)} übersetzt, {len(fehlt)} fehlen, {len(alt)} veraltet")
        if nur:
            for s in fehlt:
                print("  FEHLT:", s)
            for s in alt:
                print("  ALT:  ", s)


if __name__ == "__main__":
    main()
