/**
 * FVA – Gemeinsame Basemap
 * ---------------------------------------------------------------------
 * Wird von JEDER karte_*.html eingebunden (nach vendor/maplibre-gl.js).
 * Fachspezifischer Code (Layer, Datenquellen, Popup-Inhalte) gehört NICHT
 * hierher, sondern in die jeweilige karte_*.html – siehe README.md, Regel
 * "Karten-Init nur über FVAMap".
 *
 * Namespace: window.FVAMap. Fünf Kernfunktionen (siehe README.md):
 *   FVAMap.init(options)               – Karte aus der Basemap erzeugen
 *   FVAMap.addLegend(map, opts)        – Legende unten rechts
 *   FVAMap.popup.open(map, el, opts)   – zentriertes Popup (Titel/Tabs,
 *                                         Export, Schließen)
 *   FVAMap.lightbox.init(map)          – Bild-Lightbox für Popup-Bilder
 *   FVAMap.hover.enable(...) / .tooltip(map) – Hover-Hervorhebung + Tooltip
 *
 * Dazu ein paar schmale Ausdrucks-/DOM-Hilfsfunktionen (matchExpr,
 * caseExpr, hoverExpr, stopMapPropagation, onFullscreenChange), die jede
 * Karte sonst wortgleich selbst schreiben müsste.
 *
 * Design-Tokens (Farben, Schrift): KANONISCH in base/basemap.css als
 * CSS-Custom-Properties (:root { --fva-* }). Eigene Grafiken/Controls
 * lesen die Werte direkt per var(--fva-green) im CSS.
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
  // "attribution"). Als FVAMap.DEFAULT_ATTRIBUTION exportiert, damit
  // einzelne Karten zusätzliche Quellen anhängen können:
  //   FVAMap.init({ ..., attribution: FVAMap.DEFAULT_ATTRIBUTION + " · Daten: XY" })
  const DEFAULT_ATTRIBUTION =
    '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> ' +
    'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  // Standard-Kartenausschnitt: ganz Baden-Württemberg (aus den WRW-
  // Landkreis-Flächen ermittelt, auf ca. 1m genau gerundet). JEDE Karte
  // startet hiermit – eine karte_*.html gibt bounds/center/zoom nur in
  // Ausnahmefällen vor.
  const BW_BOUNDS = [
    [7.45209, 47.48723],
    [10.5553, 49.83647],
  ];

  /** Zeigt eine Fehlermeldung direkt im Karten-Container an (z.B. wenn
   *  WebGL fehlt oder der Style nicht geladen werden kann). */
  function showContainerError(container, message) {
    const el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el) return;
    const box = document.createElement("div");
    box.className = "fva-map-error";
    box.textContent =
      message ||
      "Die Karte konnte nicht geladen werden. Bitte Seite neu laden oder einen aktuellen Browser verwenden.";
    el.appendChild(box);
  }

  // =====================================================================
  // 1. FVAMap.init – Karte aus der FVA-Basemap erzeugen
  // =====================================================================

  /**
   * Erstellt eine MapLibre-Karte mit den gemeinsamen Grundeinstellungen.
   * Fullscreen, gesperrte Rotation, Style-Fallback und statische
   * Attribution gelten IMMER und sind bewusst KEINE Optionen – das erzwingt
   * einheitliches Verhalten über alle karte_*.html hinweg.
   * @param {Object} options
   * @param {string} [options.container="map"]
   * @param {[number,number][]} [options.bounds] – Standard: ganz Baden-
   *   Württemberg (BW_BOUNDS); i.d.R. NICHT überschreiben
   * @param {[number,number]} [options.center] – Ausnahmefall: statt bounds
   *   mit center+zoom starten (nur zusammen mit zoom, gewinnt dann gegen bounds)
   * @param {number} [options.zoom] – Ausnahmefall, nur zusammen mit center
   * @param {string} [options.ariaLabel] – Beschriftung des Karten-Containers für Screenreader
   * @param {string} [options.errorMessage] – Text bei fehlgeschlagener Initialisierung
   * @param {string|false} [options.attribution] – überschreibt DEFAULT_ATTRIBUTION;
   *   eigene Quelle anhängen z.B. mit FVAMap.DEFAULT_ATTRIBUTION + " · Daten: ...".
   *   false/"" blendet die Attribution aus (nur falls rechtlich unnötig).
   * @param {string} [options.cursor] – optionaler dauerhafter Cursor auf dem
   *   Karten-Canvas (z.B. "crosshair" für eine Klick-zum-Abfragen-Karte wie
   *   karte_eps.html); Standard: MapLibres eigene grab/pointer-Cursor.
   * @returns {maplibregl.Map}
   */
  function init(options) {
    const cfg = Object.assign(
      {
        container: "map",
        bounds: BW_BOUNDS,
        center: null,
        zoom: null,
        fitBoundsOptions: { padding: 40 },
        ariaLabel: "Interaktive Karte",
        errorMessage: null,
        attribution: DEFAULT_ATTRIBUTION,
        cursor: null,
      },
      options || {}
    );

    const mapOptions = {
      container: cfg.container,
      style: PRIMARY_STYLE,
      // Native (i)-Box aus – wir zeigen stattdessen einen festen Text
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
    // nicht ladbar war (e.sourceId fehlt dann) – nicht bei einer einzelnen
    // kaputten Kachel oder einer fachspezifischen Quelle, die eine
    // karte_*.html selbst hinzufügt (die hat immer eine sourceId). Auch an
    // styleLoaded gebunden: ein Sprite-/Glyph-Fehler ohne sourceId könnte
    // sonst noch Sitzungen später den kompletten Style austauschen und
    // damit alle selbst hinzugefügten Layer/Quellen löschen.
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

    try {
      const c = map.getContainer();
      if (!c.hasAttribute("role")) c.setAttribute("role", "region");
      if (!c.hasAttribute("aria-label")) c.setAttribute("aria-label", cfg.ariaLabel);
      if (cfg.cursor) c.classList.add("fva-map--cursor-" + cfg.cursor);
    } catch (e) {
      /* ignore */
    }

    // Gilt fest für JEDE Karte – keine Optionen, die es pro Karte abschalten könnten.
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
   *  MapLibre-(i)-Box (siehe attributionControl:false oben). */
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

  /** Verhindert, dass Scroll-/Klick-Gesten in einem Overlay (Legende,
   *  eigene Controls, Popup) die Karte darunter mitsteuern. */
  function stopMapPropagation(el) {
    if (!el) return;
    ["mousedown", "mouseup", "click", "dblclick", "wheel", "touchstart", "touchmove", "contextmenu"].forEach(
      (evt) => el.addEventListener(evt, (e) => e.stopPropagation())
    );
  }

  /**
   * Baut aus einer Style-Tabelle (Kategorie -> {...Werte}) einen MapLibre-
   * "match"-Ausdruck für EIN Paint-Property. "match" verlangt syntaktisch
   * einen Default-Wert am Ende (sonst lehnt MapLibre den ganzen Style ab);
   * fehlt fallback, wird automatisch der Wert des letzten Tabellen-
   * Eintrags genommen.
   * @param {string} field - GeoJSON-Property, gegen die verglichen wird
   * @param {Object} styleTable - z.B. {"Buche": {fill:"#..."}, "Fichte": {fill:"#..."}}
   * @param {string} valueKey - welcher Wert aus jedem Eintrag genommen wird
   * @param {*} [fallback]
   * @returns {Array}
   */
  function matchExpr(field, styleTable, valueKey, fallback) {
    const entries = Object.entries(styleTable);
    const resolvedFallback = fallback !== undefined ? fallback : entries[entries.length - 1][1][valueKey];
    return ["match", ["get", field], ...entries.flatMap(([k, v]) => [k, v[valueKey]]), resolvedFallback];
  }

  /** Baut ["case", condition, valueIfTrue, valueIfFalse]. */
  function caseExpr(condition, valueIfTrue, valueIfFalse) {
    return ["case", condition, valueIfTrue, valueIfFalse];
  }

  /** Baut den ["case", ["boolean", ["feature-state","hover"], false], ...]-
   *  Ausdruck für "Wert X bei Hover, sonst Y" (Radius/Strichstärke/-farbe). */
  function hoverExpr(hoverValue, normalValue) {
    return caseExpr(["boolean", ["feature-state", "hover"], false], hoverValue, normalValue);
  }

  // =====================================================================
  // 2. FVAMap.addLegend – Legende unten rechts
  // =====================================================================

  /**
   * Erzeugt eine Legende im gemeinsamen Basemap-Design und hängt sie unten
   * rechts in die Karte ein (feste Position, keine Option dagegen).
   * Unterstützt drei Inhalts-Arten (der Reihe nach geprüft): fertiges HTML
   * (`html`), eine Farb-/Label-Liste (`items`), oder eine Style-Tabelle
   * (`styleTable` + `colorKey`, dieselbe Tabelle wie für FVAMap.matchExpr –
   * `items` wird daraus automatisch abgeleitet).
   * Immer einklappbar; auf kleinen Bildschirmen (<=600px) startet sie
   * eingeklappt, sonst offen.
   * @param {maplibregl.Map} map
   * @param {Object} opts
   * @param {string} opts.title
   * @param {{color:string, label:string, shape?:"square"|"circle"|"ring"}[]} [opts.items] -
   *   shape ist optional (Standard "square"); "circle"/"ring" lassen die
   *   Legende wie echte Kartenpunkte aussehen (voller Punkt bzw. Punkt mit
   *   weißer Mitte), siehe karte_borkenkaefer.html
   * @param {Object} [opts.styleTable]
   * @param {string} [opts.colorKey]
   * @param {string} [opts.html]
   * @param {string} [opts.note] – optionaler Hinweistext unter der Legende
   * @returns {Object} das MapLibre-Control (für map.removeControl bei Bedarf)
   */
  function addLegend(map, opts) {
    const cfg = opts || {};
    const items =
      cfg.items ||
      (cfg.styleTable ? Object.entries(cfg.styleTable).map(([label, s]) => ({ color: s[cfg.colorKey], label })) : []);
    let box;
    const ctrl = {
      onAdd() {
        box = document.createElement("div");
        // maplibregl-ctrl setzt pointer-events:auto zurück (Ecken-Container
        // haben sonst pointer-events:none, Klicks fielen durch).
        box.className = "maplibregl-ctrl map-legend app-ctrl";
        stopMapPropagation(box);

        const header = document.createElement("button");
        header.type = "button";
        header.className = "map-legend__header";
        header.innerHTML =
          `<span>${cfg.title}</span>` + '<span class="map-legend__chevron" aria-hidden="true">&#9662;</span>';
        box.appendChild(header);

        const itemsWrap = document.createElement("div");
        itemsWrap.className = "map-legend__items";

        if (cfg.html) {
          itemsWrap.innerHTML = cfg.html;
        } else {
          items.forEach((item) => {
            const row = document.createElement("div");
            row.className = "map-legend__item";
            // shape "square" (Standard, z.B. Flächen/Kategorien) | "circle"
            // (voller Punkt, z.B. eine Falle) | "ring" (Punkt mit weißer
            // Mitte, z.B. ein Brutbeobachtungsbaum) - für Legenden, die
            // dieselbe Form wie die echten Kartenpunkte zeigen sollen
            // (siehe karte_borkenkaefer.html).
            const shape = item.shape || "square";
            const swatchClass = "map-legend__swatch" + (shape !== "square" ? ` map-legend__swatch--${shape}` : "");
            const swatchStyle = shape === "ring" ? `border-color:${item.color}` : `background:${item.color}`;
            row.innerHTML =
              `<span class="${swatchClass}" style="${swatchStyle}"></span>` + `<span>${item.label}</span>`;
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

        const startCollapsed = !!(global.matchMedia && global.matchMedia("(max-width: 600px)").matches);
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

  // =====================================================================
  // Fullscreen – FVAMap.init() schaltet den nativen Browser-Fullscreen auf
  // map.getContainer(). Alles, was NICHT Nachfahre dieses Containers ist,
  // wird während Fullscreen unsichtbar (die Fullscreen-API zeigt nur den
  // Ast des fullscreenen Elements) – deshalb hängen lightbox/popup ihr
  // Overlay in den Karten-Container statt in body, und ein offenes Overlay
  // wird beim Fullscreen-Wechsel geschlossen (sonst bleiben feste
  // Pixelmaße, z.B. eines Plotly-Charts, von vor dem Wechsel hängen).
  // =====================================================================
  function onFullscreenChange(handler) {
    ["fullscreenchange", "webkitfullscreenchange"].forEach((evt) => document.addEventListener(evt, handler));
  }

  // =====================================================================
  // 3. FVAMap.popup – zentriertes Popup (Modal) mit Titel/Tabs, Export,
  //    Schließen. Ersetzt ein an einen geografischen Punkt verankertes
  //    maplibregl.Popup: der Inhalt (Bilder, Grafiken, Tabellen) ist oft zu
  //    breit/hoch dafür, und ein Anker würde je nach Klickort/
  //    Kartenausschnitt an wechselnder Stelle aufklappen. Einmal pro Seite
  //    initialisiert (ensurePopup), Inhalt/Header werden bei jedem open()
  //    ausgetauscht.
  // =====================================================================

  function ensurePopup(map) {
    let overlay = document.getElementById("fva-modal-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "fva-modal-overlay";
    overlay.className = "fva-modal-overlay";
    overlay.innerHTML =
      '<div class="fva-modal" role="dialog" aria-modal="true">' +
      '<div class="fva-modal__header">' +
      '<span class="fva-modal__title"></span>' +
      '<span class="fva-modal__header-extra"></span>' +
      '<button type="button" class="fva-modal__export">Export</button>' +
      '<button type="button" class="fva-modal__close" aria-label="Schließen"></button>' +
      "</div>" +
      '<div class="fva-modal__body"></div>' +
      "</div>";
    map.getContainer().appendChild(overlay);

    function close() {
      if (!overlay.classList.contains("is-open")) return;
      overlay.classList.remove("is-open");
      overlay.querySelector(".fva-modal__body").innerHTML = "";
      if (overlay._fvaOnClose) overlay._fvaOnClose();
    }
    overlay.querySelector(".fva-modal__close").addEventListener("click", close);
    overlay.querySelector(".fva-modal__export").addEventListener("click", () => exportPopupPng(overlay));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(); // Klick auf den Hintergrund, nicht auf die Popup-Box
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    });
    onFullscreenChange(close);
    overlay._fvaClose = close;
    return overlay;
  }

  /**
   * Weitet einen zu schmalen/niedrigen Export-Ausschnitt kurz auf seine
   * tatsächliche Inhaltsgröße auf, statt ihn wie im Live-Popup seitlich
   * scrollbar zu lassen (.fva-scroll-x, z.B. ein Chart/SVG mit eigener
   * Mindestbreite) oder vertikal abzuschneiden (.fva-modal__body,
   * overflow:auto). Eine Box mit overflow:auto/-hidden "schluckt" den
   * Overflow ihrer Kinder nach außen - ihre EIGENE scrollWidth/-Height
   * verrät das nicht (bleibt gleich clientWidth/-Height). Deshalb reicht es
   * nicht, nur den eigentlichen Übeltäter (.fva-scroll-x) zu verbreitern:
   * jede Box AUF DEM WEG dorthin bis (und mit) target - die ja selbst
   * gerade wegen dieses Kindes überläuft - muss ihre eigene Begrenzung
   * ebenfalls loswerden, sonst schneidet sie den jetzt breiteren Nachfahren
   * einfach wieder ab.
   * Für die BREITE reicht "width:auto" auf den Vorfahren dafür NICHT immer
   * (nur ein Flex-/Grid-Item schrumpft/wächst darüber auf seinen Inhalt -
   * ein ganz normales Block-Element wie z.B. karte_eps.html's #gantt-panel
   * bliebe bei width:auto weiter exakt so breit wie SEIN Elternelement,
   * unabhängig vom jetzt breiteren Kind). Deshalb bekommt hier JEDE Ebene
   * von innen nach außen ihre eigene explizite Pixel-Breite (ihre jeweils
   * AKTUELLE scrollWidth, nachdem das jeweilige Kind schon verbreitert
   * wurde - kaskadiert so sauber nach oben). Für die HÖHE reicht
   * "height:auto" dagegen aus - Blockauto-Höhe folgt schon von selbst dem
   * Inhalt, das ist dort gerade der CSS-Normalfall.
   * Gibt eine restore()-Funktion zurück, die alle Änderungen exakt
   * rückgängig macht (auch wenn vorher kein style-Attribut da war).
   */
  function widenForExport(target) {
    const touched = [];
    function unclip(el) {
      if (touched.some(([done]) => done === el)) return;
      touched.push([el, el.getAttribute("style")]);
      el.style.overflow = "visible";
      el.style.maxWidth = "none";
      el.style.maxHeight = "none";
      el.style.width = el.scrollWidth + "px";
      el.style.height = "auto";
    }

    target.querySelectorAll(".fva-scroll-x").forEach((scroller) => {
      if (scroller.scrollWidth <= scroller.clientWidth) return;
      unclip(scroller);
      for (let el = scroller.parentElement; el; el = el.parentElement) {
        unclip(el); // el.scrollWidth hier IMMER erst NACH dem jeweiligen Kind messen
        if (el === target) break;
      }
    });

    // Kann auch ganz ohne .fva-scroll-x zu hoch für seine max-height sein
    // (z.B. ein einfaches, aber langes Popup) - dann fehlt oben der
    // Auslöser über einen Scroller, hier zusätzlich direkt behandeln.
    target.querySelectorAll(".fva-modal__body").forEach((body) => {
      if (body.scrollHeight > body.clientHeight || body.scrollWidth > body.clientWidth) {
        unclip(body);
        unclip(target);
      }
    });
    if (target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth) unclip(target);

    return function restore() {
      touched.forEach(([el, style]) => {
        if (style === null) el.removeAttribute("style");
        else el.setAttribute("style", style);
      });
    };
  }

  /** Fotografiert das Popup bis auf Export-/Schließen-Button. Erfordert
   *  vendor/html-to-image.js, geladen vom Aufrufer – ohne das nur eine
   *  Konsolenmeldung, kein harter Fehler. */
  async function exportPopupPng(overlay) {
    if (typeof htmlToImage === "undefined") {
      console.error("[FVAMap] html-to-image nicht geladen - PNG-Export nicht möglich.");
      return;
    }
    const modalEl = overlay.querySelector(".fva-modal");
    const exportBtn = overlay.querySelector(".fva-modal__export");
    const closeBtn = overlay.querySelector(".fva-modal__close");
    const originalText = exportBtn.textContent;

    // Standard: das ganze Popup fotografieren. Eine Karte mit mehreren
    // Tabs im Popup (z.B. Grafik/Tabelle) kann per opts.exportTarget nur
    // den aktiven Tab-Inhalt liefern, siehe FVAMap.popup.open.
    const target = overlay._fvaExportTarget ? overlay._fvaExportTarget(modalEl) : modalEl;
    if (!target) return;

    exportBtn.disabled = true;
    exportBtn.textContent = "…";
    exportBtn.style.visibility = "hidden";
    closeBtn.style.visibility = "hidden";
    const restoreWidth = widenForExport(target);
    try {
      // Hook z.B. für einen Chart, der sein eigenes Redraw braucht, nachdem
      // widenForExport() oben seinen Container verbreitert hat (Plotly
      // reagiert auf eine per CSS geänderte Containergröße nicht von
      // selbst synchron genug) - siehe beforeExport in karte_level2.html.
      if (overlay._fvaBeforeExport) await overlay._fvaBeforeExport();
      const dataUrl = await htmlToImage.toPng(
        target,
        Object.assign({ pixelRatio: 2, backgroundColor: "#ffffff" }, overlay._fvaExportOptions)
      );
      const exportName = typeof overlay._fvaExportName === "function" ? overlay._fvaExportName() : overlay._fvaExportName;
      const a = document.createElement("a");
      a.download = (exportName || "Export") + ".png";
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error("[FVAMap] PNG-Export fehlgeschlagen:", err);
    } finally {
      restoreWidth();
      if (overlay._fvaAfterExport) await overlay._fvaAfterExport();
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
      exportBtn.style.visibility = "";
      closeBtn.style.visibility = "";
    }
  }

  /**
   * Öffnet das zentrierte Popup mit content als Body-Inhalt. Header (Titel
   * bzw. eigener headerLeft-Inhalt wie Tabs, optional headerRight, Export,
   * Schließen) baut FVAMap selbst – der Aufrufer liefert nur den Inhalt.
   * @param {maplibregl.Map} map
   * @param {HTMLElement} content
   * @param {Object} [opts]
   * @param {string} [opts.title] - links im Header; ignoriert, wenn headerLeft gesetzt ist
   * @param {HTMLElement} [opts.headerLeft] - ersetzt den Titel-Bereich (flex:1),
   *   z.B. für Tabs (siehe karte_eps.html); dasselbe Element kann über
   *   mehrere open()-Aufrufe wiederverwendet werden (Klick-Handler bleiben erhalten)
   * @param {HTMLElement} [opts.headerRight] - zusätzliches Control vor dem
   *   Export-Button, z.B. eine Jahresauswahl (siehe karte_eps.html)
   * @param {string|(() => string)} [opts.exportName] - Dateiname (ohne .png),
   *   Standard "Export". Als Funktion, wenn er vom Zustand zum Export-
   *   Zeitpunkt abhängt (z.B. vom gerade aktiven Tab, siehe karte_eps.html)
   *   statt vom Zustand beim open()-Aufruf.
   * @param {(modalEl:HTMLElement) => HTMLElement} [opts.exportTarget] - welches
   *   Element fotografiert wird; Standard: das ganze Popup. Für Karten mit
   *   mehreren Tabs im Popup z.B. `() => document.getElementById('aktiver-tab')`
   * @param {Object} [opts.exportOptions] - zusätzliche/überschreibende Optionen
   *   für htmlToImage.toPng (z.B. `{filter: (node) => node.id !== 'spinner'}`,
   *   um ein noch sichtbares Lade-Overlay aus dem Export auszuschließen)
   * @param {number} [opts.widthPercent] - Popup-Breite als Anteil der
   *   Kartenbreite; ohne Angabe richtet sich die Breite nach dem Inhalt (bis max-width:96vw)
   * @param {number} [opts.heightPercent] - wie widthPercent, für die Höhe (bis max-height:92vh)
   * @param {() => (void|Promise<void>)} [opts.beforeExport] - läuft direkt vor
   *   der Aufnahme, NACHDEM FVAMap.popup bereits automatisch jeden zu
   *   schmalen .fva-modal__body-/.fva-scroll-x-Container auf seine
   *   tatsächliche Inhaltsbreite verbreitert hat (siehe widenForExport oben,
   *   kein Scrollbalken mehr im Export) - nur noch für Inhalte nötig, die
   *   zusätzlich selbst auf eine Containergrößenänderung reagieren müssen,
   *   z.B. ein Plotly-Chart (siehe karte_level2.html)
   * @param {() => (void|Promise<void>)} [opts.afterExport] - läuft NACH dem
   *   automatischen Zurücksetzen der Breite (s.o.), macht nur noch einen
   *   eigenen beforeExport-Eingriff rückgängig
   * @param {() => void} [opts.onClose] - läuft, wenn das Popup geschlossen wird
   *   (Klick auf X/Hintergrund, Escape, Fullscreen-Wechsel) – z.B. um einen
   *   Tooltip mitzuschließen
   * @returns {{ close: () => void }}
   */
  function openPopup(map, content, opts) {
    opts = opts || {};
    const overlay = ensurePopup(map);
    const modalEl = overlay.querySelector(".fva-modal");
    const title = overlay.querySelector(".fva-modal__title");
    const headerExtra = overlay.querySelector(".fva-modal__header-extra");

    title.innerHTML = "";
    title.hidden = true;
    headerExtra.innerHTML = "";
    headerExtra.hidden = true;

    if (opts.headerLeft) {
      title.hidden = false;
      title.appendChild(opts.headerLeft);
    } else if (opts.title) {
      title.hidden = false;
      title.textContent = opts.title;
    }
    if (opts.headerRight) {
      headerExtra.hidden = false;
      headerExtra.appendChild(opts.headerRight);
    }

    overlay._fvaExportName = opts.exportName || opts.title || "Export";
    overlay._fvaExportTarget = opts.exportTarget || null;
    overlay._fvaExportOptions = opts.exportOptions || null;
    overlay._fvaBeforeExport = opts.beforeExport || null;
    overlay._fvaAfterExport = opts.afterExport || null;
    overlay._fvaOnClose = opts.onClose || null;

    const mapEl = map.getContainer();
    modalEl.style.width = opts.widthPercent ? Math.round(mapEl.clientWidth * opts.widthPercent) + "px" : "";
    modalEl.style.height = opts.heightPercent ? Math.round(mapEl.clientHeight * opts.heightPercent) + "px" : "";

    const body = overlay.querySelector(".fva-modal__body");
    body.innerHTML = "";
    body.appendChild(content);

    overlay.classList.add("is-open");
    return { close: overlay._fvaClose };
  }

  /** true, solange das Popup gerade offen ist (z.B. um beim erneuten
   *  Rendern desselben Inhalts – etwa nach einer Filter-Änderung – zu
   *  unterscheiden "frischer Klick" vs. "Inhalt nur aktualisiert"). */
  function isPopupOpen() {
    const overlay = document.getElementById("fva-modal-overlay");
    return !!overlay && overlay.classList.contains("is-open");
  }

  // =====================================================================
  // 4. FVAMap.lightbox – Klick auf ein Popup-Bild -> vergrößerte Ansicht.
  //    Einmal pro Seite initialisieren; reagiert per Event-Delegation auf
  //    JEDES <img class="fva-popup__img" data-full="..."> im Dokument,
  //    auch wenn Popup-Inhalte dynamisch nachgeladen werden.
  // =====================================================================

  /** @param {maplibregl.Map} map - Container, in den die Lightbox gehängt
   *   wird (siehe Fullscreen-Hinweis oben). */
  function initLightbox(map) {
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

  // =====================================================================
  // 5. FVAMap.hover – Feature-Hervorhebung (feature-state) + Cursor, sowie
  //    ein leichtgewichtiges Hover-Tooltip-Element.
  // =====================================================================

  /**
   * Hebt das überfahrene Feature eines Layers per feature-state
   * {hover:true} hervor und setzt den Zeiger-Cursor. Die Quelle braucht
   * stabile Feature-Ids (generateId:true oder echte ids); die paint-
   * Ausdrücke des Layers werten ["feature-state","hover"] aus (siehe
   * FVAMap.hoverExpr).
   * @param {maplibregl.Map} map
   * @param {string} layerId
   * @param {string} sourceId
   * @returns {{ get: () => (number|string|null), clear: () => void }}
   */
  function enableHover(map, layerId, sourceId) {
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

  /** Erstellt ein Hover-Tooltip-Element und gibt Steuerfunktionen zurück.
   *  show(content, point, {html}) – html:true interpretiert content als HTML. */
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
  // Export
  // -------------------------------------------------------------------

  global.FVAMap = {
    DEFAULT_ATTRIBUTION,
    init,
    addLegend,
    popup: { open: openPopup, isOpen: isPopupOpen },
    lightbox: { init: initLightbox },
    hover: { enable: enableHover, tooltip: createHoverTooltip },
    stopMapPropagation,
    matchExpr,
    caseExpr,
    hoverExpr,
    onFullscreenChange,
  };
})(window);
