# fvamaps

Karten-Integration für die FVA-Website. Ziel: die bisher einzeln in R/Leaflet
gebauten Karten auf **eine gemeinsame Basemap** (Style, CSS, UI-Bausteine)
vereinheitlichen. Ausgeliefert werden statische Dateien (`fileadmin`/TYPO3),
eingebunden je Karte per `<iframe>`.

## Verzeichnis

```
maplibre/
  vendor/        Fremdbibliotheken, selbst gehostet (MapLibre, html-to-image) – siehe vendor/README.md
  base/          basemap.js + basemap.css  →  DIE gemeinsame Basis, nur hier ändern
  maps/          karte_*.html  →  je Karte eine Datei, nur fachspezifischer Code
    data/        Geodaten (WRW)
    test.html    →  Entwickler-Übersicht, bindet alle Karten per <iframe> ein (Kartenliste inline im MAPS-Array)
```

## Lokal testen

`fetch()` auf die GeoJSON/JSON-Datendateien funktioniert nicht über `file://`:

```sh
cd maplibre/maps
python3 -m http.server
# → http://localhost:8000/test.html
```

## Konventionen (verbindlich für neue Karten)

- **Namespace ist `FVAMap`** (`window.FVAMap`).
- **Karten-Init nur über `FVAMap.create({...})`** – liefert einheitlichen Style,
  Navigation/Fullscreen, deaktivierte Rotation, `role`/`aria-label` am Container
  und einen `error`-Handler.
- **Kartenausschnitt kommt aus der Basemap.** `create()` startet immer auf
  ganz Baden-Württemberg (`FVAMap.BW_BOUNDS`). Eine `karte_*.html` setzt
  `bounds` **nicht** – nur echte Ausnahmen geben stattdessen `center`/`zoom`
  an (diese gewinnen dann gegen `bounds`).
- **Legende immer über `FVAMap.addLegend(map, {...})`** – erzwingt die gemeinsame
  Position **unten rechts**. Nicht selbst `map.addControl(legend, ...)` aufrufen.
- **Eigene Controls** (Timeline, Layer-Auswahl, …): Container-Klasse
  `"maplibregl-ctrl <eigene-klasse> app-ctrl"`. Das `maplibregl-ctrl` ist
  Pflicht – ohne es haben die MapLibre-Ecken-Container `pointer-events: none`
  und Klicks fallen durch das Control auf die Karte (Symptom: Klick auf ein
  Overlay öffnet ein Popup/Modal). Zusätzlich `FVAMap.stopMapPropagation(el)`.
- **Farben kommen aus den Design-Tokens.** Kanonisch in `base/basemap.css`
  (`:root { --fva-* }`, Werte aus dem Website-Theme), im JS über `FVAMap.THEME`
  (wird aus den CSS-Variablen gelesen). Keine Hex-Werte in den Karten
  hartkodieren; „FVA-Grün“ ist `--fva-green` / `#006e60` (Website-`--primary`).
- **Hover-Hervorhebung**: `FVAMap.enableHoverState(map, layerId, sourceId)` setzt
  `feature-state { hover }` + Zeiger-Cursor (die paint-Ausdrücke werten
  `["feature-state","hover"]` aus, Quelle mit `generateId: true`).

Neue Karte anlegen: `maps/karte_basemap.html` kopieren und einen Eintrag im
`MAPS`-Array in `maps/test.html` ergänzen.

## Versionierung / Cache-Bust

`base/basemap.js` und `base/basemap.css` werden in jeder `karte_*.html` mit
`?v=YYYYMMDD` eingebunden. **Bei jeder Änderung an `base/` oder `vendor/` diesen
Marker in allen `maps/karte_*.html` auf das aktuelle Datum setzen**, sonst
sehen Besucher wegen Browser-/Proxy-Caching alte Stände. (Aktuell: `20260908`.)

Ein kleiner Build-Schritt, der den Marker automatisch setzt, wäre der nächste
sinnvolle Ausbau.

## Bekannte Abweichung: `karte_eps.html`

Die EPS-Karte (DWD PHENTHAUproc) ist bewusst als **komplexe Sonderkarte**
geführt: eigenes Modal, eigene Timeline/Layer-Controls, eigener Gantt-Renderer,
PNG-Export. Sie nutzt `FVAMap.create`, `FVAMap.addLegend`,
`FVAMap.stopMapPropagation` und die Design-Tokens (FVA-Grün), bringt aber viel
eigenes CSS mit (u. a. `#modal`, `.spinner`, `#gantt-tooltip`,
`body { background:#1a1a1a }`).
Wenn eine zweite Karte ein Modal / einen PNG-Export braucht, sollten diese
Teile in `base/` gehoben werden.

## Offene Punkte

- **Basemap-Kacheln** kommen zur Laufzeit von `tiles.openfreemap.org`
  (`DEFAULT_STYLE` in `base/basemap.js`). Einzige Fremd-Abhängigkeit im
  Normalbetrieb: Single Point of Failure, keine sichtbare Attribution, und der
  Besucher-IP geht an Dritte (DSGVO-Abwägung). Optionen: Style + Kacheln selbst
  hosten, oder dokumentierter Fallback + sichtbare OSM/OpenMapTiles-Attribution.
- **XSS**: Die Popup-Renderer und `FVAMap.addLegend({ html })` schreiben teils
  rohes HTML aus den Datendateien (feature-`properties`). Solange die
  GeoJSON/JSON von der FVA erzeugt werden, unkritisch – wird eine Quelle je
  CMS-/nutzereditierbar, muss escaped werden. Die `items`-Variante von
  `addLegend` (Farbe + Text, s. `karte_wrw.html`) ist der sichere Standard.
- **Barrierefreiheit** (BITV 2.0): Karten-Container hat `role`/`aria-label`,
  die einklappbare Legende ist ein fokussierbarer `<button>`, die Bild-Lightbox
  schließt mit `Esc` und stellt den Fokus zurück. Offen: Tastatur-Bedienung der
  EPS-Timeline, Kontraste der semantischen Layer-Farben.
- **Schrift**: `--fva-font` enthält den Stack der Website inkl. `"PT Sans
  Narrow"`. Der Webfont wird hier nicht mitgeliefert (kein CDN/@font-face); die
  iframes rendern im System-Fallback (`-apple-system`, `Segoe UI`, …). Falls
  identische Optik gewünscht ist, den Font in den Karten selbst einbinden.
