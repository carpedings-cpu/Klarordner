# Klarordner

Vorsorgeordner für den Todesfall in neun Bereichen, der komplett im Browser läuft. Kein Konto, keine Cloud, keine Verbindung nach außen. Eingaben bleiben automatisch auf dem Gerät des Nutzers gespeichert (IndexedDB). Als Sicherung und zur Weitergabe wird der Ordner in eine Datei `*.notfall.json` exportiert.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `app/klarordner.html` | Die App. Eine Datei mit HTML, CSS und JavaScript, läuft auch direkt per Doppelklick. |
| `app/sw.js` | Service Worker, legt die App für den Offline-Betrieb im Gerät ab. Nutzerdaten laufen nie hindurch. |
| `app/manifest.webmanifest`, `app/icons/` | Angaben und Symbole für die Installation auf dem Home-Bildschirm. |
| `app/anbieter.json` | Steckbriefe für die Schreiben im Todesfall: 32 Online-Dienste, Versorger, Vereine und Fitnessstudios, 34 Versicherer (typ "versicherung", optional adresseSach für Sachversicherungen) und 8 Krankenkassen (typ "krankenkasse"): Adresse, optional E-Mail (nur offiziell belegte), Verfahren, Unterlagen, Quellen, Prüfstand. Jährlich prüfen. |
| `app/schriften/` | Atkinson Hyperlegible und Fraunces (SIL Open Font License, Hinweise in `LIZENZEN.txt`). Das Bauskript bettet sie in die App ein, es werden keine Schriften aus dem Netz geladen. |
| `app/ocr/` | Texterkennung für „Dokument fotografieren“ (tesseract.js 7 mit deutschem Sprachpaket, Apache-Lizenz, Hinweise in `LIZENZEN.txt`). Wird erst beim ersten Scannen geladen und dann im Gerät abgelegt. |
| `app/sprachen/xx.json` | Übersetzungen. Schlüssel ist der deutsche Text, Wert die Übersetzung. `_texte.json` listet alle Anzeigetexte und wird erzeugt. |
| `docs/` | Erzeugt, wird über GitHub Pages veröffentlicht. Nicht von Hand ändern. |
| `test/` | Browsertests und erfundene Testdaten. Wird nicht ausgeliefert. |
| `werkzeuge/` | Bauskript und Erzeugung der Symbole. |

## Sprachen

Die Oberfläche gibt es in 14 Sprachen. Inhalte und Rechtshinweise beziehen sich immer auf deutsches Recht, amtliche Begriffe stehen in den Übersetzungen zusätzlich auf Deutsch in Klammern. Auswahlfelder speichern neutrale Schlüssel (`OPTIONEN` in der App), die Datei ist damit sprachunabhängig.

```
python3 werkzeuge/texte.py      # Stand aller Übersetzungen
python3 werkzeuge/texte.py tr   # fehlende und veraltete Texte einer Sprache
```

Wird ein deutscher Text in der App geändert, gilt er als neuer Text und muss in allen Sprachen neu übersetzt werden.

## Bauen

```
python3 werkzeuge/bauen.py
```

Setzt die Übersetzungen ein und erzeugt `docs/` für die Web-App mit neuer Cache-Version sowie `dist/klarordner.html` als Download-Fassung. Die Tests laufen gegen diese gebaute Fassung.

## Testen

```
node test/test-formulare.mjs   # alle Bereiche, Einträge, Speichern
node test/test-webapp.mjs      # Installation, Offline-Betrieb, Speichern über Teilen
node test/test-update.mjs      # neue Version erkennen, Hinweis, Neuladen ohne Datenverlust
node test/test-scan.mjs        # Angaben aus fotografierten Dokumenten übernehmen, auch offline
node test/test-portraet.mjs    # Porträt auswählen, Original sichern, Traueranzeige, Deckblatt
node test/test-datum.mjs       # Geburtsdatum als Ziffern eingeben
node test/test-einzeln.mjs     # einzelnes Schreiben als Brief, E-Mail oder Webseite öffnen
node test/test-video.mjs       # Videonachricht aufnehmen, abspielen, sichern, löschen
node test/test-geraet.mjs      # Speichern im Gerät, Sicherung als Datei, Löschen
node test/test-tresor.mjs      # Verschlüsselung der Zugangsdaten, Sperre, Passwortwechsel
node test/test-sprache.mjs     # Spracherkennung, Sprachwahl, Umwandlung alter Dateien, deutsche Reste
node test/test-druck.mjs       # Druckauswahl, PDF mit Kopf- und Fußzeilen, Formular, Zugangsdaten
node test/test-schritt5.mjs    # Aktualitätshinweis, Fortschritt, Sicherungskopie mit Datum
node test/test-schreiben.mjs   # vorausgefüllte Schreiben für den Todesfall als PDF
node test/test-versicherer.mjs  # Auswahl der Versicherer und Krankenkassen, Anschrift und Nummer im Brief
node test/test-import.mjs      # Kontakte aus vCard, Passwörter aus CSV-Exporten
```

## Veröffentlichen

GitHub Pages auf den Branch `main`, Ordner `/docs` stellen. Die App ist danach unter `https://<konto>.github.io/klarordner/` erreichbar.

## Sicherheit

Die Content-Security-Policy erlaubt nur Dateien der eigenen Adresse (App, Service Worker, Manifest, Symbole). Verbindungen aus der App heraus (`connect-src`) sind vollständig gesperrt. Es gibt keine Statistik, kein Tracking und keine Fehlerberichte. Nutzerdaten liegen ausschließlich in der IndexedDB des Geräts und in der vom Nutzer gesicherten Datei, nie im Cache des Service Workers. Der Bereich Zugangsdaten wird auch dort nur verschlüsselt abgelegt. Das Porträt liegt verkleinert (höchstens 1000 Pixel) im Ordner und damit in der Sicherungsdatei, das Original als eigener Eintrag in der IndexedDB. Eine Videonachricht liegt als eigener Eintrag in der IndexedDB, nicht in der Sicherungsdatei, und wird über „Video sichern“ separat exportiert. Für das Abspielen erlaubt die Content-Security-Policy `media-src blob:`, also nur lokal erzeugte Adressen. Fotos von Dokumenten werden nur im Arbeitsspeicher ausgelesen und weder gespeichert noch übertragen. Die Texterkennung läuft in einem Worker der eigenen Adresse und lädt ihre Dateien ebenfalls nur von dort. Über „Von diesem Gerät löschen“ entfernt der Nutzer seinen Ordner vollständig.
