# Klarordner

Persönlicher Notfall- und Vorsorgeordner, der komplett im Browser läuft. Kein Konto, keine Cloud, keine Verbindung nach außen. Alle Eingaben liegen in einer Datei `*.notfall.json` auf dem Gerät des Nutzers.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `app/klarordner.html` | Die App. Eine Datei mit HTML, CSS und JavaScript, läuft auch direkt per Doppelklick. |
| `app/sw.js` | Service Worker, legt die App für den Offline-Betrieb im Gerät ab. Nutzerdaten laufen nie hindurch. |
| `app/manifest.webmanifest`, `app/icons/` | Angaben und Symbole für die Installation auf dem Home-Bildschirm. |
| `docs/` | Erzeugt, wird über GitHub Pages veröffentlicht. Nicht von Hand ändern. |
| `test/` | Browsertests und erfundene Testdaten. Wird nicht ausgeliefert. |
| `werkzeuge/` | Bauskript und Erzeugung der Symbole. |

## Bauen

```
python3 werkzeuge/bauen.py
```

Erzeugt `docs/` für die Web-App mit neuer Cache-Version und `dist/klarordner.html` als Download-Fassung.

## Testen

```
node test/test-formulare.mjs   # alle Bereiche, Einträge, Speichern
node test/test-webapp.mjs      # Installation, Offline-Betrieb, Speichern über Teilen
```

## Veröffentlichen

GitHub Pages auf den Branch `main`, Ordner `/docs` stellen. Die App ist danach unter `https://<konto>.github.io/klarordner/` erreichbar.

## Sicherheit

Die Content-Security-Policy erlaubt nur Dateien der eigenen Adresse (App, Service Worker, Manifest, Symbole). Verbindungen aus der App heraus (`connect-src`) sind vollständig gesperrt. Es gibt keine Statistik, kein Tracking und keine Fehlerberichte. Nutzerdaten werden weder im Browser-Speicher noch im Cache abgelegt.
