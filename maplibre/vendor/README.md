# vendor/ – Fremdbibliotheken (selbst gehostet)

Alle Abhängigkeiten liegen als Datei im Repo (kein CDN zur Laufzeit). Gründe:
Datenschutz (keine IP-Übertragung an Dritte beim Seitenaufruf), Verfügbarkeit
(kein Fremd-Ausfall), Reproduzierbarkeit, Betrieb im `fileadmin`/TYPO3 ohne
externe Freigaben.

| Datei | Version | Lizenz | Quelle |
|-------|---------|--------|--------|
| `maplibre-gl.js`, `maplibre-gl.css` | 5.24.0 | BSD-3-Clause (`MAPLIBRE-LICENSE.txt`) | https://github.com/maplibre/maplibre-gl-js/releases/tag/v5.24.0 |
| `html-to-image.js` | 1.11.13 | MIT | https://github.com/bubkoo/html-to-image (PNG-Export in `karte_eps.html` und `karte_level2.html`) |
| `plotly-basic.min.js` | 4.1.1 (`plotly.js-basic-dist-min`) | MIT (`PLOTLY-LICENSE.txt`) | https://github.com/plotly/plotly.js (nur von `karte_level2.html` für die Wasserhaushalts-Grafik genutzt) |
| `leaflet.js`, `leaflet.css` | 1.9.4 | BSD-2-Clause (`LEAFLET-LICENSE.txt`) | https://github.com/Leaflet/Leaflet (nur vom "Maplibre - Leaflet"-Vergleichstab in `../../index.html` genutzt, nirgends in den `karte_*.html`) |

## Aktualisieren

```sh
# MapLibre (dist aus dem npm-Paket bzw. GitHub-Release):
curl -L -o maplibre-gl.js  https://cdn.jsdelivr.net/npm/maplibre-gl@<version>/dist/maplibre-gl.js
curl -L -o maplibre-gl.css https://cdn.jsdelivr.net/npm/maplibre-gl@<version>/dist/maplibre-gl.css

# html-to-image:
curl -L -o html-to-image.js https://cdn.jsdelivr.net/npm/html-to-image@<version>/dist/html-to-image.js

# Plotly ("basic"-Bundle: scatter/bar/box/histogram/pie - reicht für unsere
# Flächen-/Linien-Charts und ist deutlich kleiner als das volle plotly.js):
curl -L -o plotly-basic.min.js https://cdn.jsdelivr.net/npm/plotly.js-basic-dist-min@<version>/plotly-basic.min.js

# Leaflet:
curl -L -o leaflet.js  https://cdn.jsdelivr.net/npm/leaflet@<version>/dist/leaflet.js
curl -L -o leaflet.css https://cdn.jsdelivr.net/npm/leaflet@<version>/dist/leaflet.css
```

Nach jedem Update: Tabelle oben anpassen, `?v=`-Marker in den `karte_*.html`
(siehe `../README.md`, Abschnitt „Versionierung“) erhöhen und die vier Karten
in `../../index.html` durchklicken.

## Nicht selbst gehostet: die Basemap-Kacheln

Der Vektor-Style kommt zur Laufzeit von `tiles.openfreemap.org` (siehe
`../base/basemap.js`, `PRIMARY_STYLE`). Das ist die einzige verbleibende
Fremd-Abhängigkeit im Normalbetrieb – Bewertung/Alternativen siehe
`../README.md`, Abschnitt „Offene Punkte“. Zwei reine Vergleichs-/Testtabs in
`../../index.html` laden zusätzlich noch mehr Fremd-Kacheln direkt zur
Laufzeit - bewusst so, weil sie genau diese unveränderten Standard-Setups
zeigen sollen, nicht die FVA-Basemap:
- "Maplibre - Leaflet": `tile.openstreetmap.fr` (Leaflet/HOT) und
  `tiles.openfreemap.org` (MapLibre).
- "Basemap-Vergleich": zusätzlich `tile.openstreetmap.org` (Standard-OSM) und
  `sgx.geodatenzentrum.de` (BKG basemap.de/basemap.world).
