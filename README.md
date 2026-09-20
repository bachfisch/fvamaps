# fvamaps

Karten-Integration für die FVA-Website. Eine gemeinsame Basemap (Style, CSS,
UI-Bausteine: Legende, Popup, Lightbox, Hover) für alle Fachkarten. Ausgeliefert
werden statische Dateien (`fileadmin`/TYPO3), eingebunden je Karte per
`<iframe>`.

Dieser `dev`-Branch ist ein bewusster Neuanfang für den Produktivbetrieb:
`vendor/` und `maps/data/` sind unverändert geblieben, `base/basemap.js`,
`base/basemap.css` und alle `maps/karte_*.html` wurden neu geschrieben, um die
Regeln unten von Anfang an konsequent einzuhalten (vorher waren sie in Teilen
schon gelebte Praxis, aber nicht überall gleich streng).

## Verzeichnis

```
index.html         →  Entwickler-/Testübersicht, bindet alle Karten per <iframe> ein
                       (Kartenliste inline im MAPS-Array) - auch der Einstiegspunkt
                       für GitHub Pages
maplibre/
  vendor/        Fremdbibliotheken, selbst gehostet (MapLibre, html-to-image, Plotly) – siehe vendor/README.md
  base/          basemap.js + basemap.css  →  DIE gemeinsame Basis, nur hier ändern
  maps/          karte_*.html  →  je Karte eine Datei, nur fachspezifischer Code
    data/        Geodaten + CSVs (WRW, Level II)
```

## Lokal testen

`fetch()` auf die GeoJSON/JSON/CSV-Datendateien funktioniert nicht über
`file://`. Server im Repo-Root starten (nicht in `maplibre/maps/`), weil
`index.html` die Karten über relative Pfade ab dem Root einbindet
(`maplibre/maps/karte_*.html`):

```sh
python3 -m http.server
# → http://localhost:8000/
```

---

## Die fünf Kernfunktionen von `FVAMap`

`base/basemap.js` stellt genau fünf Bausteine bereit. Fachspezifischer Code
(Layer, Datenquellen, Popup-Inhalte) gehört NICHT in diese Datei, sondern in
die jeweilige `karte_*.html`.

1. **`FVAMap.init(options)`** – erzeugt die Karte aus der FVA-Basemap
   (Style, Navigation/Fullscreen, gesperrte Rotation, Style-Fallback,
   statische Attribution, Kartenausschnitt). Siehe Konventionen unten.
2. **`FVAMap.addLegend(map, opts)`** – Legende, immer unten rechts, immer
   einklappbar.
3. **`FVAMap.popup.open(map, content, opts)`** – zentriertes Popup
   (Titel/Tabs, optionales Extra-Control, Export-Button, Schließen-X).
   Ersetzt ein an einen Kartenpunkt verankertes `maplibregl.Popup` – der
   Inhalt (Bilder, Grafiken, Tabellen) ist oft zu breit/hoch dafür, und ein
   Anker würde je nach Klickort an wechselnder Stelle aufklappen.
4. **`FVAMap.lightbox.init(map)`** – Bild-Lightbox; reagiert per
   Event-Delegation auf jedes `<img class="fva-popup__img" data-full="...">`.
5. **`FVAMap.hover`** – `enable(map, layerId, sourceId)` (feature-state-
   Hervorhebung + Cursor) und `tooltip(map)` (leichtgewichtiges
   Hover-Tooltip-Element).

Dazu ein paar schmale Hilfsfunktionen, die jede Karte sonst wortgleich selbst
schreiben müsste: `FVAMap.matchExpr`/`caseExpr`/`hoverExpr` (Paint-Ausdrücke),
`FVAMap.stopMapPropagation`, `FVAMap.onFullscreenChange`,
`FVAMap.DEFAULT_ATTRIBUTION`.

## Aufbau einer `karte_*.html` – feste Reihenfolge

Jede `karte_*.html` folgt derselben Gliederung, im Code auch so kommentiert
(`// 1. ...` bis `// 6. ...`). Das ist eine Lese-Konvention, keine technische
Vorschrift – bei einer inhaltsreichen Karte wie `karte_eps.html` überschneiden
sich Abschnitte leicht (z.B. eigene Map-Controls direkt nach der
Karten-Initialisierung), die Reihenfolge links-nach-rechts bleibt aber
erkennbar:

1. **Filepaths** – Konstanten für Datenquellen (GeoJSON-/CSV-URLs).
2. **Legende** – Style-Tabelle/Items, aus der sich Paint-Ausdrücke *und* die
   Legende ableiten (`FVAMap.matchExpr`, `FVAMap.addLegend`).
3. **Karte initialisieren** – `FVAMap.init(...)`.
4. **Hover/Lightbox/…** – `FVAMap.lightbox.init(map)`,
   `FVAMap.hover.tooltip(map)`; nur was die Karte tatsächlich braucht (eine
   reine WMS-Rasterkarte ohne Vektor-Features/Bilder braucht z.B. keins von
   beidem, siehe `karte_eps.html`).
5. **Popup-Verdrahtung für Inhalte** – `map.on('load', ...)`: Quellen, Layer,
   `FVAMap.hover.enable`, Klick-Handler, die das Popup öffnen.
6. **Fachspezifische Funktionen für Popup-Inhalte** – der Popup-Inhalt selbst
   (DOM bauen, Daten laden/aufbereiten, ggf. ein eigenständiges Render-Modul
   wie `WHChart` in `karte_level2.html`).

Neue Karte anlegen: `maps/karte_basemap.html` kopieren (enthält alle sechs
Abschnitte als leere Gerüst-Kommentare) und einen Eintrag im `MAPS`-Array in
`index.html` ergänzen.

## Verbindliche Konventionen

- **Namespace ist `FVAMap`** (`window.FVAMap`). Karten-Init NUR über
  `FVAMap.init({...})` – liefert einheitlichen Style, Navigation/Fullscreen,
  gesperrte Rotation, `role`/`aria-label` am Container und einen
  `error`-Handler.
- **Kartenausschnitt kommt aus der Basemap.** `init()` startet immer auf ganz
  Baden-Württemberg (intern `BW_BOUNDS`). Eine `karte_*.html` setzt `bounds`
  **nicht** – nur echte Ausnahmen geben stattdessen `center`+`zoom` zusammen
  an (die gewinnen dann gegen `bounds`).
- **Legende immer über `FVAMap.addLegend(map, {...})`** – erzwingt die
  gemeinsame Position unten rechts. Nicht selbst `map.addControl(legend, ...)`
  aufrufen.
- **Popup immer über `FVAMap.popup.open(map, content, opts)`** – Titel/Tabs,
  Export-Button und Schließen-X kommen von dort, der Aufrufer liefert nur den
  Inhalt. `opts.headerLeft`/`opts.headerRight` für Sonderfälle wie Tabs oder
  eine Jahresauswahl (siehe `karte_eps.html`), `opts.exportTarget` wenn nicht
  das ganze Popup fotografiert werden soll (z.B. nur der aktive Tab).
- **Eigene Controls** (Timeline, Layer-Auswahl, …): Container-Klasse
  `"maplibregl-ctrl fva-panel app-ctrl <eigene-klasse>"`. `maplibregl-ctrl`
  ist Pflicht – ohne es haben die MapLibre-Ecken-Container
  `pointer-events: none` und Klicks fallen durch das Control auf die Karte.
  `fva-panel` liefert die gemeinsame Box-Optik (Hintergrund/Radius/Schatten),
  wie sie auch die Legende nutzt. Zusätzlich `FVAMap.stopMapPropagation(el)`.
- **Farben kommen aus den Design-Tokens.** Kanonisch in `base/basemap.css`
  (`:root { --fva-* }`, Werte aus dem Website-Theme). Kein JS-Äquivalent –
  eigene Grafiken/Controls lesen die Werte direkt per `var(--fva-green)` im
  CSS. Keine Hex-Werte für FVA-Grün in den Karten hartkodieren.
- **Hover-Hervorhebung**: `FVAMap.hover.enable(map, layerId, sourceId)` setzt
  `feature-state { hover }` + Zeiger-Cursor (die paint-Ausdrücke werten
  `["feature-state","hover"]` aus, Quelle mit `generateId: true`; siehe
  `FVAMap.hoverExpr`).

### CSS: keine lokalen Styles in `karte_*.html`, wenn vermeidbar

Alles, was mehr als eine Karte betreffen KÖNNTE, gehört in `base/basemap.css`,
nicht in ein lokales `<style>` in der `karte_*.html` – auch wenn aktuell nur
eine Karte es braucht (siehe die Kommentare in `basemap.css`: „ungenutzte
Regeln haben keine Kosten"). Dafür stehen dort u.a. bereit: `.fva-panel`
(Control-Box-Optik), `.fva-tabs`/`.fva-tab` (Tab-Leiste, sowohl im
Popup-Header als auch im Popup-Inhalt nutzbar), `.fva-spinner`/
`.fva-spinner-overlay` (Ladeanzeige), `.fva-scroll-x` (horizontal scrollender
Wrapper für zu breite Inhalte), `.fva-popup__hint` (Status-/Fehlertext),
`.fva-tooltip` (Hover-Tooltip-Optik).

Ein lokales `<style>` in einer `karte_*.html` ist NUR für Dinge gedacht, die
wirklich einmalig für genau diese Karte sind: die konkrete Geometrie einer
selbstgezeichneten SVG-Grafik (z.B. der Gantt-Chart in `karte_eps.html`), das
Skin eines nicht wiederverwendbaren Custom-Controls (der Zeitschieberegler in
`karte_eps.html`), oder Tabellen-/Grafik-spezifische Feinheiten. Bevor eine
neue lokale Regel entsteht: kurz prüfen, ob sie eigentlich ein
wiederverwendbares Muster ist (dann nach `basemap.css`) oder wirklich
Einzelfall (dann lokal, mit Kommentar warum).

Für kleine One-off-Layouts (eine einzelne per JS gebaute Zeile, ein Meta-Feld)
ist ein Inline-`style`-Attribut auf dem per `createElement` gebauten Element
in Ordnung – das ist kein „lokales CSS" im Sinne dieser Regel, solange es sich
nicht wiederholt.

### JS-Struktur

- Kein Build-Schritt, keine Module – klassische `<script>`-Tags, geladen in
  fester Reihenfolge (`maplibre-gl.js` → `basemap.js` → optionale
  Vendor-Skripte → der Karten-Code selbst).
- Fachspezifische Konstanten/Funktionen bleiben in der `karte_*.html`, nicht
  in `basemap.js` – auch wenn sie generisch aussehen. `basemap.js` wächst nur,
  wenn ein Muster wirklich von mehr als einer Karte gebraucht wird.
- Ein eigenständiges Render-Modul (wie `WHChart` in `karte_level2.html`) darf
  als IIFE in einem zweiten `<script>`-Tag *am Ende derselben Datei* stehen,
  wenn es nur von dieser einen Karte genutzt wird.

## Bekannte Abweichung: `karte_eps.html`

Die EPS-Karte (DWD PHENTHAUproc) ist bewusst als **komplexe Sonderkarte**
geführt: WMS-Rasterlayer mit Zeitschieberegler, eigener Gantt-Chart-Renderer
(SVG, keine Chart-Bibliothek), Koordinatentransformation nach Gauß-Krüger
Zone 3 für GetFeatureInfo-Abfragen. Sie nutzt trotzdem `FVAMap.init`,
`FVAMap.addLegend`, `FVAMap.popup.open` (mit `headerLeft` für die
Grafik/Tabelle-Tabs und `headerRight` für die Jahresauswahl),
`FVAMap.stopMapPropagation` und die Design-Tokens wie jede andere Karte –
Timeline- und Layer-Auswahl-Control sowie die Gantt-/Tabellen-Geometrie
bleiben lokales CSS, weil sie nicht wiederverwendbar sind (siehe Regel oben).

## Offene Punkte

- **Basemap-Kacheln** kommen zur Laufzeit von `tiles.openfreemap.org`
  (`PRIMARY_STYLE` in `base/basemap.js`, Fallback auf rohe OSM-Kacheln bei
  Nichterreichbarkeit, sichtbare Attribution über `DEFAULT_ATTRIBUTION`).
  Einzige verbleibende Fremd-Abhängigkeit im Normalbetrieb: die Besucher-IP
  geht an Dritte (DSGVO-Abwägung) – offene Option wäre, Style + Kacheln selbst
  zu hosten.
- **XSS**: Die Popup-Inhalte und `FVAMap.addLegend({ html })` schreiben teils
  rohes HTML aus den Datendateien (Feature-`properties`). Solange die
  GeoJSON/JSON/CSV von der FVA erzeugt werden, unkritisch – wird eine Quelle
  je CMS-/nutzereditierbar, muss escaped werden. Die `items`/`styleTable`-
  Variante von `addLegend` (Farbe + Text, keine rohen HTML-Strings) ist der
  sichere Standard.
- **Barrierefreiheit** (BITV 2.0): Karten-Container hat `role`/`aria-label`,
  die einklappbare Legende ist ein fokussierbarer `<button>`, Popup und
  Bild-Lightbox schließen mit `Esc` und stellen den Fokus zurück. Offen:
  Tastatur-Bedienung der EPS-Timeline, Kontraste der semantischen
  Layer-Farben.
- **Schrift**: `--fva-font` enthält den Stack der Website inkl. `"PT Sans
  Narrow"`. Der Webfont wird hier nicht mitgeliefert (kein CDN/@font-face);
  die iframes rendern im System-Fallback (`-apple-system`, `Segoe UI`, …).
  `karte_eps.html` nutzt bewusst einen eigenen Font-Stack (`'Segoe UI'` statt
  `--fva-font`), unverändert aus der Vorversion übernommen.
