/**
 * FVA – Gemeinsame Basemap
 * ---------------------------------------------------------------------
 * Wird von JEDER karte_*.html eingebunden (nach vendor/maplibre-gl.js).
 * Stellt die Karten-Initialisierung, Legenden-Baukasten und
 * Layer-Interaktion bereit. Fachspezifischer Code (Layer, Datenquellen,
 * Popups) gehört NICHT hierher, sondern in die jeweilige karte_*.html.
 *
 * Namespace: window.FVAMap
 *
 * Design-Tokens (Farben, Schrift): KANONISCH in base/basemap.css als
 * CSS-Custom-Properties (:root { --fva-* }). Wird hier nirgends als JS
 * gebraucht - eigene Grafiken/Controls lesen die Werte direkt per
 * var(--fva-green) im CSS, siehe basemap.css und die style-Blöcke der
 * einzelnen karte_*.html.
 *
 * KONVENTION - diese Dinge gelten für JEDE Karte fest und sind bewusst
 * KEINE Optionen von create(), damit keine karte_*.html versehentlich
 * davon abweichen kann:
 *   - Fullscreen-Control an
 *   - Rotation gesperrt (Drag + Touch)
 *   - Style-Fallback auf rohe OSM-Kacheln, falls der Haupt-Style nicht ladbar ist
 *   - statische Attribution statt der interaktiven MapLibre-(i)-Box
 * ---------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const PRIMARY_STYLE = "https://tiles.openfreemap.org/styles/positron";

  // Kommt nur zum Einsatz, wenn PRIMARY_STYLE nicht ladbar ist (Dienst down
  // o.ä.). Baut die Karte direkt aus rohen Kacheln, unabhängig von einem
  // zweiten style.json-Dienst.
  const FALLBACK_STYLE = {
    version: 8,
    sources: {
      "osm-fallback": {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap-Mitwirkende",
      },
    },
    layers: [{ id: "osm-fallback-layer", type: "raster", source: "osm-fallback" }],
  };

  // Standard-Attributionstext, wenn eine Karte keinen eigenen angibt.
  // Volltext von https://tiles.openfreemap.org/planet (TileJSON-Feld
  // "attribution") übernommen. Als FVAMap.DEFAULT_ATTRIBUTION exportiert,
  // damit einzelne Karten zusätzliche Quellen anhängen können, ohne den
  // Pflichttext neu abschreiben zu müssen:
  //   FVAMap.create({ ..., attribution: FVAMap.DEFAULT_ATTRIBUTION + " · Daten: XY" })
  const DEFAULT_ATTRIBUTION =
    '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> ' +
    'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  // Standard-Kartenausschnitt: ganz Baden-Württemberg (aus den WRW-
  // Landkreis-Flächen ermittelt, auf ca. 1m genau gerundet). JEDE Karte
  // startet hiermit – eine karte_*.html gibt bounds/center/zoom nur in
  // Ausnahmefällen vor. Nur intern gebraucht (Default unten), deshalb kein
  // API-Export.
  const BW_BOUNDS = [
    [7.45209, 47.48723],
    [10.55530, 49.83647],
  ];

  /** Zeigt eine Fehlermeldung direkt im Karten-Container an (z. B. wenn WebGL
   *  fehlt oder der Style nicht geladen werden kann). */
  function showContainerError(container, message) {
    const el =
      typeof container === "string"
        ? document.getElementById(container)
        : container;
    if (!el) return;
    const box = document.createElement("div");
    box.className = "fva-map-error";
    box.textContent =
      message ||
      "Die Karte konnte nicht geladen werden. Bitte Seite neu laden oder einen aktuellen Browser verwenden.";
    el.appendChild(box);
  }

  /**
   * Erstellt eine MapLibre-Karte mit den gemeinsamen Grundeinstellungen.
   * Fullscreen, gesperrte Rotation, Style-Fallback und die statische
   * Attribution gelten IMMER (siehe Konvention oben) und sind bewusst
   * keine Optionen.
   * @param {Object} options
   * @param {string} [options.container="map"]
   * @param {[number,number][]} [options.bounds] – Standard: ganz Baden-Württemberg (BW_BOUNDS); i.d.R. NICHT überschreiben
   * @param {[number,number]} [options.center] – Ausnahmefall: statt bounds mit center+zoom starten (nur zusammen mit zoom, gewinnt dann gegen bounds)
   * @param {number} [options.zoom] – Ausnahmefall, nur zusammen mit center
   * @param {string}  [options.ariaLabel] – Beschriftung des Karten-Containers für Screenreader
   * @param {string}  [options.errorMessage] – Text bei fehlgeschlagener Initialisierung
   * @param {string}  [options.attribution] – überschreibt DEFAULT_ATTRIBUTION komplett; eigene Quelle anhängen z.B. mit FVAMap.DEFAULT_ATTRIBUTION + " · Daten: ...". Leerstring/false blendet die Attribution aus (nur falls rechtlich unnötig).
   * @returns {maplibregl.Map}
   */
  function create(options) {
    const cfg = Object.assign(
      {
        container: "map",
        // Standard = ganz Baden-Württemberg. center/zoom bleiben null und
        // werden nur ausgewertet, wenn eine Karte sie ausdrücklich setzt.
        bounds: BW_BOUNDS,
        center: null,
        zoom: null,
        fitBoundsOptions: { padding: 40 },
        ariaLabel: "Interaktive Karte",
        errorMessage: null,
        attribution: DEFAULT_ATTRIBUTION,
      },
      options || {}
    );

    const mapOptions = {
      container: cfg.container,
      style: PRIMARY_STYLE,
      // Native (i)-Box aus - wir zeigen stattdessen einen festen Text
      // (siehe createAttributionControl unten), fest für jede Karte.
      attributionControl: false,
    };

    // Ausnahmefall: Karte gibt explizit center+zoom vor -> das gewinnt.
    // Normalfall: bounds (Default BW_BOUNDS, oder von der Karte überschrieben).
    if (cfg.center != null && cfg.zoom != null) {
      mapOptions.center = cfg.center;
      mapOptions.zoom = cfg.zoom;
    } else {
      mapOptions.bounds = cfg.bounds;
      mapOptions.fitBoundsOptions = cfg.fitBoundsOptions;
    }

    let map;
    try {
      map = new maplibregl.Map(mapOptions);
    } catch (err) {
      console.error("[FVAMap] Karte konnte nicht initialisiert werden:", err);
      showContainerError(cfg.container, cfg.errorMessage);
      throw err;
    }

    // Springt nur ein, wenn das GANZE Style-Dokument beim initialen Laden
    // nicht ladbar war (e.sourceId fehlt dann) - nicht bei einer einzelnen
    // kaputten Kachel oder einer fachspezifischen Quelle, die eine
    // karte_*.html selbst hinzufügt (die hat immer eine sourceId).
    // Zusätzlich an styleLoaded gebunden: Sprite-/Glyph-Fehler melden sich
    // ebenfalls ohne sourceId, können aber jederzeit während der Session
    // auftreten (nicht nur beim initialen Laden) - ohne diese Absicherung
    // würde ein solcher später Fehler den kompletten Style austauschen und
    // damit alle von der Karte selbst hinzugefügten Layer/Quellen löschen.
    let fallbackApplied = false;
    let styleLoaded = false;
    map.once("load", () => {
      styleLoaded = true;
    });
    map.on("error", (e) => {
      if (!fallbackApplied && !styleLoaded && e && e.sourceId === undefined) {
        fallbackApplied = true;
        console.warn("[FVAMap] Basemap-Style nicht ladbar, wechsle auf Fallback:", e.error);
        map.setStyle(FALLBACK_STYLE);
      } else {
        console.error("[FVAMap] MapLibre-Fehler:", (e && e.error) || e);
      }
    });

    // Barrierefreiheit: Container als Region mit Beschriftung auszeichnen.
    try {
      const c = map.getContainer();
      if (!c.hasAttribute("role")) c.setAttribute("role", "region");
      if (!c.hasAttribute("aria-label")) c.setAttribute("aria-label", cfg.ariaLabel);
    } catch (e) {
      /* ignore */
    }

    // Gilt fest für JEDE Karte - keine Optionen, die es pro Karte
    // abschalten könnten.
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.FullscreenControl(), "top-left");

    if (cfg.attribution) {
      map.addControl(createAttributionControl(cfg.attribution), "bottom-right");
    }

    return map;
  }

  /** Eigene, dauerhaft sichtbare Attribution statt der interaktiven
   *  MapLibre-(i)-Box (siehe attributionControl:false oben). Bewusst KEIN
   *  "app-ctrl" (das gäbe den üblichen 10px-Rand wie Legende/Nav) - stattdessen
   *  MapLibres eigene "maplibregl-ctrl-attrib"-Klasse (siehe
   *  vendor/maplibre-gl.css), damit die Box bündig unten rechts sitzt statt
   *  vom Kartenrand abzurücken. */
  function createAttributionControl(html) {
    let el;
    return {
      onAdd() {
        el = document.createElement("div");
        el.className = "maplibregl-ctrl maplibregl-ctrl-attrib fva-attribution";
        el.innerHTML = html;
        return el;
      },
      onRemove() {
        el && el.parentNode && el.parentNode.removeChild(el);
      },
    };
  }

  /** Verhindert, dass Scroll-/Klick-Gesten in einem Overlay (z. B. Legende,
   *  Timeline, Layer-Auswahl) die Karte darunter mitsteuern. */
  function stopMapPropagation(el) {
    if (!el) return;
    [
      "mousedown", "mouseup", "click", "dblclick", "wheel",
      "touchstart", "touchmove", "contextmenu",
    ].forEach((evt) => el.addEventListener(evt, (e) => e.stopPropagation()));
  }

  /**
   * Baut aus einer Style-Tabelle (Kategorie -> {...Werte}, z. B. einer je
   * Karte selbst definierten Konstante wie HAUPTZIELSETZUNG_STYLE) einen
   * MapLibre-"match"-Ausdruck für EIN Paint-Property - erspart das manuelle
   * Ausschreiben von ["match", ["get", feld], k1, v1, k2, v2, ..., fallback]
   * in jeder karte_*.html. MapLibre selbst akzeptiert keine rohe Tabelle als
   * Paint-Wert, nur dieses flache Array - die Umwandlung lässt sich nicht
   * sparen, aber wenigstens nur einmal schreiben.
   * "match" VERLANGT syntaktisch einen letzten Default-Wert (MapLibre lehnt
   * den Style sonst mit "Expected an odd number of arguments" komplett ab,
   * nicht nur die eine Kategorie) - fehlt fallback hier, wird deshalb
   * automatisch der Wert des LETZTEN Tabellen-Eintrags genommen, statt dass
   * jede Karte ihn selbst nochmal heraussuchen muss.
   * Passt nur bei EXAKTER Gleichheit (wie "match" selbst) - braucht eine
   * Karte einen Teilstring-Vergleich (z. B. baumart "Bannwald_Buche"
   * enthält "Buche"), ist FVAMap.caseExpr(["in", ...], ...) die richtige
   * Wahl, nicht diese Funktion.
   * @param {string} field - GeoJSON-Property, gegen die verglichen wird
   * @param {Object} styleTable - z.B. {"Bestandesvitalität": {fillColor:"#FFAEB9", fillOpacity:0.5}, ...}
   * @param {string} valueKey - welcher Wert aus jedem Tabellen-Eintrag genommen wird (z.B. "fillColor")
   * @param {*} [fallback] - Wert für unbekannte/neue Kategorien; Standard: Wert des letzten Tabellen-Eintrags
   * @returns {Array} fertiger MapLibre-Ausdruck, direkt als Paint-Wert nutzbar
   */
  function matchExpr(field, styleTable, valueKey, fallback) {
    const entries = Object.entries(styleTable);
    const resolvedFallback = fallback !== undefined ? fallback : entries[entries.length - 1][1][valueKey];
    return ["match", ["get", field],
      ...entries.flatMap(([k, v]) => [k, v[valueKey]]),
      resolvedFallback,
    ];
  }

  /**
   * Baut ["case", condition, valueIfTrue, valueIfFalse] - der allgemeine
   * Baustein hinter hoverExpr() unten, aber auch für andere zweigeteilte
   * Fälle nutzbar, z. B. ein Substring-Check statt exaktem Vergleich (dort,
   * wo FVAMap.matchExpr wegen nicht-exakter Werte nicht passt).
   * @param {Array} condition - fertiger MapLibre-Bedingungs-Ausdruck (z.B. ["in", "Buche", ["get","baumart"]])
   * @param {*} valueIfTrue
   * @param {*} valueIfFalse
   * @returns {Array} fertiger MapLibre-Ausdruck, direkt als Paint-Wert nutzbar
   */
  function caseExpr(condition, valueIfTrue, valueIfFalse) {
    return ["case", condition, valueIfTrue, valueIfFalse];
  }

  /**
   * Baut den ["case", ["boolean", ["feature-state","hover"], false], ...]-
   * Ausdruck, der in JEDER Karte für "Wert X bei Hover, sonst Wert Y"
   * gebraucht wird (Radius/Strichstärke/-farbe etc.) - erspart das
   * Ausschreiben in jedem Paint-Property einzeln. Dünner Wrapper um
   * caseExpr() mit fest eingebauter Hover-Bedingung.
   * @param {*} hoverValue - Wert, wenn feature-state.hover true ist
   * @param {*} normalValue - Wert sonst
   * @returns {Array} fertiger MapLibre-Ausdruck, direkt als Paint-Wert nutzbar
   */
  function hoverExpr(hoverValue, normalValue) {
    return caseExpr(["boolean", ["feature-state", "hover"], false], hoverValue, normalValue);
  }

  // -------------------------------------------------------------------
  // Legende – als echtes MapLibre-Control (map.addControl(...)), damit
  // Positionierung/Abstand konsistent mit Navigation/Fullscreen erfolgt.
  // KONVENTION: Legenden sitzen IMMER unten rechts - das erzwingt
  // addLegend() direkt, es gibt bewusst keine Option dagegen.
  // -------------------------------------------------------------------

  /**
   * Erzeugt eine Legende im gemeinsamen Basemap-Design und hängt sie unten
   * rechts in die Karte ein. Unterstützt drei Inhalts-Arten (der Reihe nach
   * geprüft): direktes HTML (`html`, für aufwändiger gestaltete Legenden),
   * eine fertige Farb-/Label-Liste (`items`), oder eine Style-Tabelle
   * (`styleTable` + `colorKey`) - dieselbe Tabelle, die auch schon
   * FVAMap.matchExpr für die Paint-Ausdrücke verwendet (siehe
   * karte_wrw.html/karte_level2.html) - `items` wird dann automatisch draus
   * abgeleitet, statt dass jede Karte dasselbe
   * `Object.entries(tabelle).map(([label,s]) => ({color:s[key], label}))`
   * nochmal selbst schreibt.
   *
   * Immer einklappbar (keine Option, siehe Konvention oben). Auf
   * kleinen Bildschirmen (<=600px) startet sie automatisch eingeklappt,
   * damit man dort nicht nur Legende statt Karte sieht; sonst offen.
   *
   * @param {Object} map
   * @param {Object} opts
   * @param {string} opts.title
   * @param {{color:string, label:string}[]} [opts.items]
   * @param {Object} [opts.styleTable] – Alternative zu items: Tabelle wie bei
   *   FVAMap.matchExpr (Kategorie -> {...Werte}); Reihenfolge der Objekt-Keys
   *   bestimmt die Reihenfolge in der Legende
   * @param {string} [opts.colorKey] – welcher Wert aus jedem styleTable-
   *   Eintrag als Farbe genommen wird (z.B. "fillColor"), nur mit styleTable nötig
   * @param {string} [opts.html] – alternative zu items/styleTable: fertiges HTML für den Inhalt
   * @param {string} [opts.note] – optionaler Hinweistext unter der Legende
   * @returns {Object} das MapLibre-Control, damit es bei Bedarf per
   *   map.removeControl(...) wieder entfernt werden kann
   */
  function addLegend(map, opts) {
    const cfg = opts || {};
    const items = cfg.items || (cfg.styleTable
      ? Object.entries(cfg.styleTable).map(([label, s]) => ({ color: s[cfg.colorKey], label }))
      : []);
    let box;
    const ctrl = {
      onAdd() {
        box = document.createElement("div");
        // maplibregl-ctrl setzt pointer-events:auto zurück (die Ecken-Container
        // haben pointer-events:none). Ohne diese Klasse würden Klicks durch die
        // Legende auf die Karte "durchfallen".
        box.className = "maplibregl-ctrl map-legend app-ctrl";
        stopMapPropagation(box);

        const header = document.createElement("button");
        header.type = "button";
        header.className = "map-legend__header";
        header.innerHTML =
          `<span>${cfg.title}</span>` +
          '<span class="map-legend__chevron" aria-hidden="true">&#9662;</span>';
        box.appendChild(header);

        const itemsWrap = document.createElement("div");
        itemsWrap.className = "map-legend__items";

        if (cfg.html) {
          itemsWrap.innerHTML = cfg.html;
        } else {
          items.forEach((item) => {
            const row = document.createElement("div");
            row.className = "map-legend__item";
            row.innerHTML =
              `<span class="map-legend__swatch" style="background:${item.color}"></span>` +
              `<span>${item.label}</span>`;
            itemsWrap.appendChild(row);
          });
        }

        if (cfg.note) {
          const note = document.createElement("div");
          note.className = "map-legend__note";
          note.innerHTML = cfg.note;
          itemsWrap.appendChild(note);
        }

        box.appendChild(itemsWrap);

        // Fester Standard (keine Option): auf kleinen Screens eingeklappt
        // starten, sonst offen. 600px ~ Smartphone-Breite.
        const startCollapsed =
          !!(global.matchMedia && global.matchMedia("(max-width: 600px)").matches);
        header.setAttribute("aria-expanded", String(!startCollapsed));
        if (startCollapsed) box.classList.add("is-collapsed");

        header.addEventListener("click", () => {
          const collapsed = box.classList.toggle("is-collapsed");
          header.setAttribute("aria-expanded", String(!collapsed));
        });

        return box;
      },
      onRemove() {
        box && box.parentNode && box.parentNode.removeChild(box);
      },
    };
    map.addControl(ctrl, "bottom-right");
    return ctrl;
  }

  // -------------------------------------------------------------------
  // Layer-Interaktion – Hover-Hervorhebung + Cursor, für jeden
  // Layer-Typ (fill, line, circle).
  // -------------------------------------------------------------------

  /**
   * Hebt das jeweils überfahrene Feature eines Layers per
   * feature-state { hover: true } hervor und setzt den Zeiger-Cursor.
   * Die Quelle braucht stabile Feature-Ids (generateId:true oder echte
   * ids); die paint-Ausdrücke des Layers werten ["feature-state","hover"] aus.
   *
   * @param {maplibregl.Map} map
   * @param {string} layerId
   * @param {string} sourceId
   * @returns {{ get: () => (number|string|null), clear: () => void }}
   */
  function enableHoverState(map, layerId, sourceId) {
    let hoveredId = null;

    function clear() {
      if (hoveredId !== null) {
        map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
        hoveredId = null;
      }
    }

    map.on("mousemove", layerId, (e) => {
      if (!e.features.length) return;
      map.getCanvas().style.cursor = "pointer";
      const id = e.features[0].id;
      if (hoveredId !== null && hoveredId !== id) {
        map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
      }
      hoveredId = id;
      map.setFeatureState({ source: sourceId, id: id }, { hover: true });
    });

    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
      clear();
    });

    return { get: () => hoveredId, clear: clear };
  }

  // -------------------------------------------------------------------
  // Fullscreen: FVAMap.create() schaltet den nativen Browser-Fullscreen auf
  // map.getContainer() (siehe FullscreenControl). Alles, was NICHT
  // Nachfahre dieses Containers ist - z.B. ein an document.body gehängtes
  // Overlay - wird während Fullscreen unsichtbar (die Fullscreen-API zeigt
  // nur den Ast des fullscreenen Elements). initImageLightbox()/openModal()
  // hängen ihre Overlays deshalb in den Karten-Container statt in body.
  // Zusätzlich: ein offenes Overlay beim Fullscreen-Wechsel schließen, sonst
  // bleiben Plotly-Chart-Maße (feste Pixelbreite/-höhe aus der Container-
  // Größe VOR dem Wechsel) hängen und wirken hinterher verzerrt/zu groß.
  // Als FVAMap.onFullscreenChange exportiert, weil karte_eps.html dasselbe
  // für sein eigenes Modal braucht, siehe dort.
  // -------------------------------------------------------------------
  function onFullscreenChange(handler) {
    ["fullscreenchange", "webkitfullscreenchange"].forEach((evt) =>
      document.addEventListener(evt, handler)
    );
  }

  // -------------------------------------------------------------------
  // Bild-Lightbox (Klick auf ein Popup-Bild -> vergrößerte Ansicht)
  // Einmal pro Seite initialisieren; reagiert per Event-Delegation auf
  // JEDES <img class="fva-popup__img" data-full="..."> im Dokument, auch
  // wenn Popups dynamisch nachgeladen werden.
  // @param {maplibregl.Map} map - Container, in den die Lightbox gehängt
  //   wird (siehe Fullscreen-Hinweis oben).
  // -------------------------------------------------------------------
  function initImageLightbox(map) {
    if (document.getElementById("fva-lightbox")) return; // nur einmal initialisieren

    const box = document.createElement("div");
    box.id = "fva-lightbox";
    box.className = "fva-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Bildvorschau");
    box.innerHTML = '<img alt="" />';
    map.getContainer().appendChild(box);

    const img = box.querySelector("img");
    let lastFocus = null;

    function open(src, alt) {
      lastFocus = document.activeElement;
      img.src = src;
      img.alt = alt || "";
      box.classList.add("is-open");
      box.tabIndex = -1;
      box.focus();
    }

    function close() {
      box.classList.remove("is-open");
      img.removeAttribute("src");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      lastFocus = null;
    }

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.classList && target.classList.contains("fva-popup__img")) {
        open(target.getAttribute("data-full") || target.src, target.alt);
      }
    });

    box.addEventListener("click", close);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && box.classList.contains("is-open")) close();
    });

    onFullscreenChange(close);
  }

  // -------------------------------------------------------------------
  // Hover-Tooltip
  // -------------------------------------------------------------------

  /** Erstellt ein einfaches Hover-Tooltip-Element und gibt Steuerfunktionen zurück.
   *  show(content, point, { html }) – html:true interpretiert content als HTML. */
  function createHoverTooltip(map) {
    const el = document.createElement("div");
    el.className = "fva-tooltip";
    map.getContainer().appendChild(el);

    return {
      el: el,
      show(content, point, opts) {
        opts = opts || {};
        if (opts.html) el.innerHTML = content;
        else el.textContent = content;
        el.style.left = point.x + "px";
        el.style.top = point.y + "px";
        el.style.display = "block";
      },
      hide() {
        el.style.display = "none";
      },
      remove() {
        el.parentNode && el.parentNode.removeChild(el);
      },
    };
  }

  // -------------------------------------------------------------------
  // Zentriertes Modal (fixer Viewport-Overlay, IMMER mittig) - für
  // Popup-Inhalte, die zu breit/hoch für ein normales maplibregl.Popup
  // taugen (Bilder, Charts). Ein map.Popup+setLngLat() zeigt IMMER an
  // einem geografischen Punkt und springt damit je nach Klickort/
  // Kartenausschnitt an eine andere Stelle - für so einen breiten Inhalt
  // störend.
  // Fester Header mit optionalem Titel links, Export + Schließen-X rechts -
  // JEDES Modal sieht so gleich aus, der Aufrufer liefert nur noch den
  // Body-Inhalt (siehe karte_wrw.html/karte_level2.html). Export macht per
  // html-to-image (muss der Aufrufer laden, siehe dortige <script>-Tags) ein
  // PNG von allem außer den beiden Header-Buttons - dafür werden die beim
  // Export kurz unsichtbar geschaltet (nicht aus dem DOM entfernt, damit
  // sich am Layout währenddessen nichts verschiebt).
  // Einmal pro Seite initialisiert (wie initImageLightbox oben), Titel/
  // Inhalt werden bei jedem open() ausgetauscht.
  // -------------------------------------------------------------------
  function ensureModal(map) {
    let overlay = document.getElementById("fva-modal-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "fva-modal-overlay";
    overlay.className = "fva-modal-overlay";
    overlay.innerHTML =
      '<div class="fva-modal" role="dialog" aria-modal="true">' +
      '<div class="fva-modal__header">' +
      '<span class="fva-modal__title"></span>' +
      '<button type="button" class="fva-modal__export">Export</button>' +
      '<button type="button" class="fva-modal__close" aria-label="Schließen"></button>' +
      "</div>" +
      '<div class="fva-modal__body"></div>' +
      "</div>";
    map.getContainer().appendChild(overlay);

    function close() {
      overlay.classList.remove("is-open");
      overlay.querySelector(".fva-modal__body").innerHTML = "";
    }
    overlay.querySelector(".fva-modal__close").addEventListener("click", close);
    overlay.querySelector(".fva-modal__export").addEventListener("click", () => exportModalPng(overlay));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(); // Klick auf den Hintergrund, nicht auf die Modal-Box
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    });
    onFullscreenChange(close);
    overlay._fvaClose = close;
    return overlay;
  }

  /** Fotografiert das ganze Modal bis auf Export-/Schließen-Button (siehe
   *  Kommentar oben). Erfordert vendor/html-to-image.js, geladen vom
   *  Aufrufer - ohne das nur eine Konsolenmeldung, kein harter Fehler. */
  async function exportModalPng(overlay) {
    if (typeof htmlToImage === "undefined") {
      console.error("[FVAMap] html-to-image nicht geladen - PNG-Export nicht möglich.");
      return;
    }
    const modal = overlay.querySelector(".fva-modal");
    const exportBtn = overlay.querySelector(".fva-modal__export");
    const closeBtn = overlay.querySelector(".fva-modal__close");
    const originalText = exportBtn.textContent;

    exportBtn.disabled = true;
    exportBtn.textContent = "…";
    exportBtn.style.visibility = "hidden";
    closeBtn.style.visibility = "hidden";
    try {
      // Hook für Inhalte mit eigenem Scroll-Bereich (z.B. ein Plotly-Chart
      // in .fva-scroll-x, siehe karte_level2.html): html-to-image bemisst
      // die Export-Canvas am clientWidth des Modals - was per overflow-x nur
      // scrollbar (nicht wirklich sichtbar) ist, würde sonst abgeschnitten.
      // beforeExport() bekommt hier die Chance, so einen Inhalt auf die
      // tatsächlich verfügbare (schmalere) Breite zurückzuschrumpfen, statt
      // dass wir hier generisch versuchen müssten, das Modal künstlich zu
      // verbreitern.
      if (overlay._fvaBeforeExport) await overlay._fvaBeforeExport();
      const dataUrl = await htmlToImage.toPng(modal, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.download = (overlay._fvaExportName || "Export") + ".png";
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error("[FVAMap] PNG-Export fehlgeschlagen:", err);
    } finally {
      if (overlay._fvaAfterExport) await overlay._fvaAfterExport();
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
      exportBtn.style.visibility = "";
      closeBtn.style.visibility = "";
    }
  }

  /**
   * Öffnet ein zentriertes Modal mit content als Body-Inhalt. Header (Titel +
   * Export + Schließen) baut FVAMap selbst - der Aufrufer liefert nur den
   * Inhalt (üblicherweise ein .fva-popup__body, siehe
   * karte_wrw.html/karte_level2.html), keinen eigenen Header.
   * @param {maplibregl.Map} map - Container, in den das Modal gehängt wird
   *   (siehe Fullscreen-Hinweis über initImageLightbox oben).
   * @param {HTMLElement} content
   * @param {Object} [opts]
   * @param {string} [opts.title] - links im Header, weggelassen wenn leer
   * @param {string} [opts.exportName] - Dateiname (ohne .png) für den
   *   PNG-Export, Standard "Export"
   * @param {() => (void|Promise<void>)} [opts.beforeExport] - läuft direkt vor
   *   der Aufnahme, z.B. um einen scrollbaren Inhalt (.fva-scroll-x) auf
   *   die sichtbare Breite zu schrumpfen
   * @param {() => (void|Promise<void>)} [opts.afterExport] - macht das nach
   *   der Aufnahme wieder rückgängig, läuft auch bei einem fehlgeschlagenen
   *   Export
   * @returns {{ close: () => void }}
   */
  function openModal(map, content, opts) {
    opts = opts || {};
    const overlay = ensureModal(map);
    const title = overlay.querySelector(".fva-modal__title");
    title.textContent = opts.title || "";
    title.hidden = !opts.title;
    overlay._fvaExportName = opts.exportName || opts.title || "Export";
    overlay._fvaBeforeExport = opts.beforeExport || null;
    overlay._fvaAfterExport = opts.afterExport || null;
    const body = overlay.querySelector(".fva-modal__body");
    body.innerHTML = "";
    body.appendChild(content);
    overlay.classList.add("is-open");
    return { close: overlay._fvaClose };
  }

  // -------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------

  const api = {
    DEFAULT_ATTRIBUTION,
    create,
    stopMapPropagation,
    matchExpr,
    caseExpr,
    hoverExpr,
    addLegend,
    enableHoverState,
    onFullscreenChange,
    initImageLightbox,
    openModal,
    createHoverTooltip,
  };

  global.FVAMap = api;
})(window);
