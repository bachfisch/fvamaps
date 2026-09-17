# fvamaps

Karten-Integration für die FVA-Website. Ziel: die bisher einzeln in R/Leaflet
gebauten Karten auf **eine gemeinsame Basemap** (Style, CSS, UI-Bausteine)
vereinheitlichen. Ausgeliefert werden statische Dateien (`fileadmin`/TYPO3),
eingebunden je Karte per `<iframe>`.

## Verzeichnis

```
index.html         →  Entwickler-/Testübersicht, bindet alle Karten per <iframe> ein
                       (Kartenliste inline im MAPS-Array) - auch der Einstiegspunkt
                       für GitHub Pages (siehe unten)
maplibre/
  vendor/        Fremdbibliotheken, selbst gehostet (MapLibre, html-to-image, Plotly) – siehe vendor/README.md
  base/          basemap.js + basemap.css  →  DIE gemeinsame Basis, nur hier ändern
  maps/          karte_*.html  →  je Karte eine Datei, nur fachspezifischer Code
    data/        Geodaten + CSVs (WRW, Level II)
```

## Lokal testen

`fetch()` auf die GeoJSON/JSON-Datendateien funktioniert nicht über `file://`.
Server im Repo-Root starten (nicht in `maplibre/maps/`), weil `index.html` die
Karten über relative Pfade ab dem Root einbindet (`maplibre/maps/karte_*.html`):

```sh
python3 -m http.server
# → http://localhost:8000/
```

## Konventionen (verbindlich für neue Karten)

- **Namespace ist `FVAMap`** (`window.FVAMap`).
- **Karten-Init nur über `FVAMap.create({...})`** – liefert einheitlichen Style,
  Navigation/Fullscreen, deaktivierte Rotation, `role`/`aria-label` am Container
  und einen `error`-Handler.
- **Kartenausschnitt kommt aus der Basemap.** `create()` startet immer auf
  ganz Baden-Württemberg (intern `BW_BOUNDS` in `basemap.js`). Eine
  `karte_*.html` setzt `bounds` **nicht** – nur echte Ausnahmen geben
  stattdessen `center`+`zoom` zusammen an (diese gewinnen dann gegen `bounds`).
- **Legende immer über `FVAMap.addLegend(map, {...})`** – erzwingt die gemeinsame
  Position **unten rechts**. Nicht selbst `map.addControl(legend, ...)` aufrufen.
- **Eigene Controls** (Timeline, Layer-Auswahl, …): Container-Klasse
  `"maplibregl-ctrl <eigene-klasse> app-ctrl"`. Das `maplibregl-ctrl` ist
  Pflicht – ohne es haben die MapLibre-Ecken-Container `pointer-events: none`
  und Klicks fallen durch das Control auf die Karte (Symptom: Klick auf ein
  Overlay öffnet ein Popup/Modal). Zusätzlich `FVAMap.stopMapPropagation(el)`.
- **Farben kommen aus den Design-Tokens.** Kanonisch in `base/basemap.css`
  (`:root { --fva-* }`, Werte aus dem Website-Theme). Kein JS-Äquivalent -
  eigene Grafiken/Controls lesen die Werte direkt per `var(--fva-green)` im
  CSS. Keine Hex-Werte in den Karten hartkodieren; „FVA-Grün“ ist
  `--fva-green` / `#006e60` (Website-`--primary`).
- **Hover-Hervorhebung**: `FVAMap.enableHoverState(map, layerId, sourceId)` setzt
  `feature-state { hover }` + Zeiger-Cursor (die paint-Ausdrücke werten
  `["feature-state","hover"]` aus, Quelle mit `generateId: true`).

Neue Karte anlegen: `maps/karte_basemap.html` kopieren und einen Eintrag im
`MAPS`-Array in `index.html` ergänzen.


## Bekannte Abweichung: `karte_eps.html`

Die EPS-Karte (DWD PHENTHAUproc) ist bewusst als **komplexe Sonderkarte**
geführt: eigenes Modal, eigene Timeline/Layer-Controls, eigener Gantt-Renderer,
eigener PNG-Export. Sie nutzt `FVAMap.create`, `FVAMap.addLegend`,
`FVAMap.stopMapPropagation`, `FVAMap.onFullscreenChange` und die Design-Tokens
(FVA-Grün), bringt aber viel eigenes CSS mit (u. a. `#modal`, `.spinner`,
`#gantt-tooltip`, `body { background:#1a1a1a }`) und nutzt bewusst NICHT
`FVAMap.openModal` (das `karte_wrw.html`/`karte_level2.html` verwenden) - ihr
Modal-Header hat mit den Grafik-/Tabelle-Tabs eine andere Struktur, für die
sich das generische Modal nicht eignet.

## Offene Punkte

- **Basemap-Kacheln** kommen zur Laufzeit von `tiles.openfreemap.org`
  (`PRIMARY_STYLE` in `base/basemap.js`, Fallback auf rohe OSM-Kacheln bei
  Nichterreichbarkeit, sichtbare Attribution über `DEFAULT_ATTRIBUTION`).
  Einzige verbleibende Fremd-Abhängigkeit im Normalbetrieb: die Besucher-IP
  geht an Dritte (DSGVO-Abwägung) - offene Option wäre, Style + Kacheln selbst
  zu hosten.
- **XSS**: Die Popup-Renderer und `FVAMap.addLegend({ html })` schreiben teils
  rohes HTML aus den Datendateien (feature-`properties`). Solange die
  GeoJSON/JSON von der FVA erzeugt werden, unkritisch – wird eine Quelle je
  CMS-/nutzereditierbar, muss escaped werden. Die `items`/`styleTable`-Variante
  von `addLegend` (Farbe + Text, keine rohen HTML-Strings) ist der sichere
  Standard.
- **Barrierefreiheit** (BITV 2.0): Karten-Container hat `role`/`aria-label`,
  die einklappbare Legende ist ein fokussierbarer `<button>`, die Bild-Lightbox
  schließt mit `Esc` und stellt den Fokus zurück. Offen: Tastatur-Bedienung der
  EPS-Timeline, Kontraste der semantischen Layer-Farben.
- **Schrift**: `--fva-font` enthält den Stack der Website inkl. `"PT Sans
  Narrow"`. Der Webfont wird hier nicht mitgeliefert (kein CDN/@font-face); die
  iframes rendern im System-Fallback (`-apple-system`, `Segoe UI`, …). Falls
  identische Optik gewünscht ist, den Font in den Karten selbst einbinden.
