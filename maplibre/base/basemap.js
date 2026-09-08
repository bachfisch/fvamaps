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
 * Design-Tokens: KANONISCH in base/basemap.css (:root { --fva-* }). Das
 * THEME-Objekt hier wird beim Laden UND bei jedem create()-Aufruf aus
 * diesen CSS-Variablen aufgefrischt; die Literale unten sind nur der
 * Fallback, falls das Stylesheet noch nicht geladen ist.
 * ---------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/positron";

  // Standard-Kartenausschnitt: ganz Baden-Württemberg (aus den WRW-
  // Landkreis-Flächen ermittelt). JEDE Karte startet hiermit – eine
  // karte_*.html gibt bounds/center/zoom nur in Ausnahmefällen vor.
  const BW_BOUNDS = [
    [7.452092513195585, 47.48722644667095],
    [10.55530403242152, 49.83647412316834],
  ];

  // Nur Fallback, falls eine Karte bewusst mit center/zoom statt bounds startet.
  const BW_CENTER = [9.15, 48.65];
  const BW_ZOOM = 7.2;

  /** Zentrale Design-Tokens für JS (z. B. in Karten gebaute Grafiken), damit
   *  sie zur Basemap passen – Zugriff über FVAMap.THEME. Die Werte hier sind
   *  Fallbacks; refreshTheme() überschreibt sie mit den tatsächlichen
   *  CSS-Variablen aus base/basemap.css (kanonische Quelle). */
  const THEME = {
    colorPrimary: "#006e60",
    colorPrimaryDark: "#00544a",
    colorText: "#343a40",
    colorTextMuted: "#6c757d",
    colorBorder: "#dee2e6",
    colorDanger: "#ff4136",
    fontFamily:
      '"PT Sans Narrow", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  };

  /** Liest eine CSS-Custom-Property von :root, mit Fallback. */
  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  /** Frischt THEME aus den CSS-Variablen auf (CSS ist die kanonische Quelle). */
  function refreshTheme() {
    THEME.colorPrimary = cssVar("--fva-green", THEME.colorPrimary);
    THEME.colorPrimaryDark = cssVar("--fva-green-dark", THEME.colorPrimaryDark);
    THEME.colorText = cssVar("--fva-text", THEME.colorText);
    THEME.colorTextMuted = cssVar("--fva-text-muted", THEME.colorTextMuted);
    THEME.colorBorder = cssVar("--fva-border", THEME.colorBorder);
    THEME.colorDanger = cssVar("--fva-danger", THEME.colorDanger);
    THEME.fontFamily = cssVar("--fva-font", THEME.fontFamily);
    return THEME;
  }
  refreshTheme();

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
   * @param {Object} options
   * @param {string} [options.container="map"]
   * @param {[number,number][]} [options.bounds] – Standard: ganz Baden-Württemberg (BW_BOUNDS); i.d.R. NICHT überschreiben
   * @param {[number,number]} [options.center] – Ausnahmefall: statt bounds mit center/zoom starten (gewinnt gegen bounds)
   * @param {number} [options.zoom] – Ausnahmefall, zusammen mit center
   * @param {boolean} [options.showNavigation=true]
   * @param {boolean} [options.showFullscreen=true]
   * @param {boolean} [options.showCompass=false]
   * @param {boolean} [options.disableRotation=true]
   * @param {string}  [options.ariaLabel] – Beschriftung des Karten-Containers für Screenreader
   * @param {string}  [options.errorMessage] – Text bei fehlgeschlagener Initialisierung
   * @param {string}  [options.style] – Basemap-Style-URL, fest vorgegeben, i.d.R. nicht überschreiben
   * @returns {maplibregl.Map}
   */
  function create(options) {
    refreshTheme();

    const cfg = Object.assign(
      {
        container: "map",
        style: DEFAULT_STYLE,
        // Standard = ganz Baden-Württemberg. center/zoom bleiben null und
        // werden nur ausgewertet, wenn eine Karte sie ausdrücklich setzt.
        bounds: BW_BOUNDS,
        center: null,
        zoom: null,
        fitBoundsOptions: { padding: 40 },
        showNavigation: true,
        showFullscreen: true,
        showCompass: false,
        disableRotation: true,
        ariaLabel: "Interaktive Karte",
        errorMessage: null,
      },
      options || {}
    );

    const mapOptions = {
      container: cfg.container,
      style: cfg.style,
    };

    // Ausnahmefall: Karte gibt explizit center/zoom vor -> das gewinnt.
    // Normalfall: bounds (Default BW_BOUNDS, oder von der Karte überschrieben).
    if (cfg.center != null || cfg.zoom != null) {
      mapOptions.center = cfg.center != null ? cfg.center : BW_CENTER;
      mapOptions.zoom = cfg.zoom != null ? cfg.zoom : BW_ZOOM;
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

    // Nicht-fatale Laufzeitfehler (Tile-/Style-/Quellenfehler) sichtbar loggen,
    // statt sie stillschweigend zu verschlucken.
    map.on("error", (e) => {
      console.error("[FVAMap] MapLibre-Fehler:", (e && e.error) || e);
    });

    // Barrierefreiheit: Container als Region mit Beschriftung auszeichnen.
    try {
      const c = map.getContainer();
      if (!c.hasAttribute("role")) c.setAttribute("role", "region");
      if (!c.hasAttribute("aria-label")) c.setAttribute("aria-label", cfg.ariaLabel);
    } catch (e) {
      /* ignore */
    }

    if (cfg.disableRotation) {
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
    }
    if (cfg.showNavigation) {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: cfg.showCompass }),
        "top-left"
      );
    }
    if (cfg.showFullscreen) {
      map.addControl(new maplibregl.FullscreenControl(), "top-left");
    }

    return map;
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

  // -------------------------------------------------------------------
  // Legende – als echtes MapLibre-Control (map.addControl(...)), damit
  // Positionierung/Abstand konsistent mit Navigation/Fullscreen erfolgt.
  // KONVENTION: Legenden sitzen IMMER unten rechts. Deshalb bitte
  // FVAMap.addLegend(map, opts) verwenden – das erzwingt 'bottom-right'.
  // -------------------------------------------------------------------

  /**
   * Erstellt ein Legenden-Control im gemeinsamen Basemap-Design.
   * Unterstützt entweder eine einfache Farb-/Label-Liste (`items`) oder,
   * für aufwändiger gestaltete Legenden, direktes HTML (`html`).
   *
   * @param {Object} opts
   * @param {string} opts.title
   * @param {{color:string, label:string}[]} [opts.items]
   * @param {string} [opts.html] – alternative zu items: fertiges HTML für den Inhalt
   * @param {string} [opts.note] – optionaler Hinweistext unter der Legende
   * @param {boolean} [opts.collapsible=true]
   * @returns {Object} MapLibre-IControl
   */
  function createLegendControl(opts) {
    const cfg = Object.assign({ collapsible: true }, opts || {});
    let box;
    return {
      onAdd() {
        box = document.createElement("div");
        // maplibregl-ctrl setzt pointer-events:auto zurück (die Ecken-Container
        // haben pointer-events:none). Ohne diese Klasse würden Klicks durch die
        // Legende auf die Karte "durchfallen".
        box.className = "maplibregl-ctrl map-legend app-ctrl";
        stopMapPropagation(box);

        const header = document.createElement(cfg.collapsible ? "button" : "div");
        header.className = "map-legend__header";
        if (cfg.collapsible) {
          header.type = "button";
          header.setAttribute("aria-expanded", "true");
        }
        header.innerHTML =
          `<span>${cfg.title}</span>` +
          (cfg.collapsible
            ? '<span class="map-legend__chevron" aria-hidden="true">&#9662;</span>'
            : "");
        box.appendChild(header);

        const itemsWrap = document.createElement("div");
        itemsWrap.className = "map-legend__items";

        if (cfg.html) {
          itemsWrap.innerHTML = cfg.html;
        } else {
          (cfg.items || []).forEach((item) => {
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

        if (cfg.collapsible) {
          header.addEventListener("click", () => {
            const collapsed = box.classList.toggle("is-collapsed");
            header.setAttribute("aria-expanded", String(!collapsed));
          });
        }

        return box;
      },
      onRemove() {
        box && box.parentNode && box.parentNode.removeChild(box);
      },
    };
  }

  /**
   * Erzeugt eine Legende und hängt sie an der gemeinsamen Position
   * (unten rechts) in die Karte ein. Rückgabe = das Control, damit es bei
   * Bedarf per map.removeControl(...) wieder entfernt werden kann.
   */
  function addLegend(map, opts) {
    const ctrl = createLegendControl(opts);
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
  // Bild-Lightbox (Klick auf ein Popup-Bild -> vergrößerte Ansicht)
  // Einmal pro Seite initialisieren; reagiert per Event-Delegation auf
  // JEDES <img class="fva-popup__img" data-full="..."> im Dokument, auch
  // wenn Popups dynamisch nachgeladen werden.
  // -------------------------------------------------------------------
  function initImageLightbox() {
    if (document.getElementById("fva-lightbox")) return; // nur einmal initialisieren

    const box = document.createElement("div");
    box.id = "fva-lightbox";
    box.className = "fva-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Bildvorschau");
    box.innerHTML = '<img alt="" />';
    document.body.appendChild(box);

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
  // Export
  // -------------------------------------------------------------------

  const api = {
    BW_BOUNDS,
    THEME,
    refreshTheme,
    create,
    stopMapPropagation,
    createLegendControl,
    addLegend,
    enableHoverState,
    initImageLightbox,
    createHoverTooltip,
  };

  global.FVAMap = api;
})(window);
