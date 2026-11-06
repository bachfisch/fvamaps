# fvamaps

Karten für die FVA-Website auf Basis von MapLibre. Alle Fachkarten nutzen eine
gemeinsame Basemap (`maplibre/base/basemap.js` + `basemap.css`) und werden als
statische Dateien je Karte per `<iframe>` eingebunden. Jede Karte liegt als
eigene `maplibre/maps/karte_*.html` vor und enthält nur ihren fachspezifischen
Code.

## Die 5 Funktionen von `FVAMap`

**1. `FVAMap.init(options)`**
Erzeugt die Karte mit FVA-Style, Navigation, Vollbild und gesperrter Rotation.
Startet immer auf ganz Baden-Württemberg.

**2. `FVAMap.addLegend(map, opts)`**
Fügt die Legende hinzu, immer unten rechts und einklappbar.

**3. `FVAMap.popup.open(map, content, opts)`**
Öffnet ein zentriertes Popup mit Titel, Export-Button und Schließen-X. Die
Karte liefert nur den Inhalt.

**4. `FVAMap.lightbox.init(map)`**
Vergrößert Bilder per Klick. Reagiert auf jedes
`<img class="fva-popup__img" data-full="...">`.

**5. `FVAMap.hover`**
`enable(map, layerId, sourceId)` hebt Features beim Überfahren hervor und
ändert den Cursor. `tooltip(map)` zeigt einen kleinen Hover-Tooltip.