/**
 * FVA – Gemeinsame Basemap
 * ---------------------------------------------------------------------
 * Wird von JEDER karte_*.html eingebunden (nach vendor/maplibre-gl.js).
 * Stellt die Karten-Initialisierung, Popup-Hülle, Legenden-Baukasten und
 * die Live-Datenanbindung (z. B. CSV-Nachladen beim Öffnen eines Popups)
 * bereit. Fachspezifischer Code (Layer, Datenquellen, individuelle
 * Popup-Grafiken) gehört NICHT hierher, sondern in die jeweilige
 * karte_*.html.
 * ---------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/positron";

  // Grobe Startansicht Baden-Württemberg (nur Fallback, wenn keine bounds
  // übergeben werden).
  const BW_CENTER = [9.15, 48.65];
  const BW_ZOOM = 7.2;

  /** Zentrale Design-Tokens – Popup-Renderer bekommen dieses Objekt, damit
   *  auch individuelle Grafiken (Charts etc.) automatisch zur Basemap passen. */
  const THEME = {
    colorPrimary: "#047136",
    colorPrimaryDark: "#03592a",
    colorText: "#222222",
    colorTextMuted: "#666666",
    colorBorder: "#e2e2e2",
    colorDanger: "#b3261e",
    fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
    categorical: ["#047136", "#8a6d3b", "#2e6f95", "#a13d63", "#c98a1f", "#4b4b8f"],
  };

  /**
   * Erstellt eine MapLibre-Karte mit den gemeinsamen Grundeinstellungen.
   * @param {Object} options
   * @param {string} [options.container="map"]
   * @param {[number,number][]} [options.bounds] – bevorzugt gegenüber center/zoom
   * @param {[number,number]} [options.center]
   * @param {number} [options.zoom]
   * @param {boolean} [options.showNavigation=true]
   * @param {boolean} [options.showFullscreen=true]
   * @param {boolean} [options.showCompass=false]
   * @param {boolean} [options.disableRotation=true]
   * @param {string}  [options.style] – Basemap-Style-URL, fest vorgegeben, i.d.R. nicht überschreiben
   * @returns {maplibregl.Map}
   */
  function create(options) {
    const cfg = Object.assign(
      {
        container: "map",
        style: DEFAULT_STYLE,
        center: BW_CENTER,
        zoom: BW_ZOOM,
        bounds: null,
        fitBoundsOptions: { padding: 40 },
        showNavigation: true,
        showFullscreen: true,
        showCompass: false,
        disableRotation: true,
      },
      options || {}
    );

    const mapOptions = {
      container: cfg.container,
      style: cfg.style,
    };

    if (cfg.bounds) {
      mapOptions.bounds = cfg.bounds;
      mapOptions.fitBoundsOptions = cfg.fitBoundsOptions;
    } else {
      mapOptions.center = cfg.center;
      mapOptions.zoom = cfg.zoom;
    }

    const map = new maplibregl.Map(mapOptions);

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
   * @returns {Object} MapLibre-IControl (in map.addControl(legend, 'bottom-right') einhängen)
   */
  function createLegendControl(opts) {
    const cfg = Object.assign({ collapsible: true }, opts || {});
    let box;
    return {
      onAdd() {
        box = document.createElement("div");
        box.className = "map-legend app-ctrl";
        stopMapPropagation(box);

        const header = document.createElement("div");
        header.className = "map-legend__header";
        header.innerHTML =
          `<span>${cfg.title}</span>` +
          (cfg.collapsible ? '<span class="map-legend__chevron">&#9662;</span>' : "");
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
          header.addEventListener("click", () => box.classList.toggle("is-collapsed"));
        }

        return box;
      },
      onRemove() {
        box && box.parentNode && box.parentNode.removeChild(box);
      },
    };
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
    box.innerHTML = '<img alt="" />';
    document.body.appendChild(box);

    const img = box.querySelector("img");

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.classList && target.classList.contains("fva-popup__img")) {
        img.src = target.getAttribute("data-full") || target.src;
        box.classList.add("is-open");
      }
    });

    box.addEventListener("click", () => {
      box.classList.remove("is-open");
      img.removeAttribute("src");
    });
  }

  // -------------------------------------------------------------------
  // Hover-Tooltip
  // -------------------------------------------------------------------

  /** Erstellt ein einfaches Hover-Tooltip-Element und gibt Steuerfunktionen zurück. */
  function createHoverTooltip(map) {
    const el = document.createElement("div");
    el.className = "fva-tooltip";
    map.getContainer().appendChild(el);

    return {
      show(text, point) {
        el.textContent = text;
        el.style.left = point.x + "px";
        el.style.top = point.y + "px";
        el.style.display = "block";
      },
      hide() {
        el.style.display = "none";
      },
    };
  }

  // -------------------------------------------------------------------
  // Popup-Hülle + Live-Datenanbindung
  // -------------------------------------------------------------------

  /**
   * Öffnet eine Popup-Hülle im gemeinsamen Design. Der Inhalt wird über
   * `render(bodyEl)` befüllt – synchron ODER als Promise (z. B. wenn
   * vorher Daten nachgeladen werden, siehe openDataPopup).
   */
  function openPopup(map, lngLat, opts) {
    const cfg = Object.assign({ title: "", large: false }, opts || {});

    const root = document.createElement("div");
    root.className = "fva-popup" + (cfg.large ? " fva-popup--large" : "");

    if (cfg.title) {
      const header = document.createElement("div");
      header.className = "fva-popup__header";
      header.textContent = cfg.title;
      root.appendChild(header);
    }

    const body = document.createElement("div");
    body.className = "fva-popup__body";
    root.appendChild(body);

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "none" })
      .setLngLat(lngLat)
      .setDOMContent(root)
      .addTo(map);

    if (typeof cfg.render === "function") {
      cfg.render(body, popup);
    }

    return { popup, body };
  }

  /** Zeigt einen Lade-Zustand im Popup-Body. */
  function renderLoadingState(body, text) {
    body.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fva-popup__state";
    wrap.innerHTML = '<span class="fva-spinner"></span><span></span>';
    wrap.querySelector("span:last-child").textContent = text || "Daten werden geladen …";
    body.appendChild(wrap);
  }

  /** Zeigt einen Fehler-Zustand im Popup-Body (z. B. externe Quelle nicht erreichbar). */
  function renderErrorState(body, text) {
    body.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fva-popup__state fva-popup__state--error";
    wrap.textContent = text || "Daten aktuell nicht verfügbar.";
    body.appendChild(wrap);
  }

  /**
   * Minimaler, dependency-freier CSV-Parser für den Standardfall
   * (Komma- oder Semikolon-getrennt, erste Zeile = Header).
   * Für komplexere CSV-Dateien kann bei Bedarf PapaParse ergänzt werden.
   */
  function parseCSV(text) {
    const rows = text.trim().split(/\r?\n/).filter(Boolean);
    if (rows.length === 0) return [];
    const delimiter = rows[0].indexOf(";") > -1 && rows[0].indexOf(",") === -1 ? ";" : ",";
    const headers = rows[0].split(delimiter).map((h) => h.trim());
    return rows.slice(1).map((row) => {
      const cells = row.split(delimiter);
      const obj = {};
      headers.forEach((h, i) => {
        const v = (cells[i] || "").trim();
        const num = Number(v.replace(",", "."));
        obj[h] = v !== "" && !isNaN(num) ? num : v;
      });
      return obj;
    });
  }

  /**
   * Lädt eine CSV-Datei mit Cache-Busting (verhindert veraltete Anzeige,
   * wenn eine Abteilung die Datei am selben Pfad ersetzt hat).
   */
  async function fetchCSV(url) {
    const bust = (url.indexOf("?") > -1 ? "&" : "?") + "_=" + Date.now();
    const res = await fetch(url + bust, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    const text = await res.text();
    return parseCSV(text);
  }

  /**
   * Öffnet ein Popup, lädt anschließend Live-Daten (Standardfall: CSV) und
   * ruft dann `renderChart(body, data, theme)` auf. Übernimmt Lade- und
   * Fehlerzustand automatisch, siehe Konzept-Dokument Abschnitt 6.
   *
   * @param {maplibregl.Map} map
   * @param {[number,number]} lngLat
   * @param {Object} opts
   * @param {string} opts.title
   * @param {string} opts.dataUrl – URL zur CSV-Datei (same-origin oder CORS-freigegeben)
   * @param {function(HTMLElement, Array<Object>, Object): void} opts.renderChart
   * @param {boolean} [opts.large=true]
   */
  function openDataPopup(map, lngLat, opts) {
    const cfg = Object.assign({ large: true }, opts || {});
    const { body } = openPopup(map, lngLat, {
      title: cfg.title,
      large: cfg.large,
      render: (body) => renderLoadingState(body, "Aktuelle Daten werden geladen …"),
    });

    fetchCSV(cfg.dataUrl)
      .then((data) => {
        body.innerHTML = "";
        cfg.renderChart(body, data, THEME);
      })
      .catch((err) => {
        console.error("[FVA Basemap] Datenabruf fehlgeschlagen:", cfg.dataUrl, err);
        renderErrorState(body, "Daten aktuell nicht verfügbar.");
      });
  }

  // -------------------------------------------------------------------
  // Ladebalken für die gesamte Karte (optional, z. B. beim Nachladen
  // großer Layer)
  // -------------------------------------------------------------------

  function createLoadingIndicator(map, text) {
    const el = document.createElement("div");
    el.className = "fva-map-loading";
    el.innerHTML = '<span class="fva-spinner"></span><span></span>';
    el.querySelector("span:last-child").textContent = text || "Karte wird geladen …";
    map.getContainer().appendChild(el);
    return {
      hide() { el.hidden = true; },
      show() { el.hidden = false; },
      remove() { el.remove(); },
    };
  }

  // -------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------

  global.BehoerdeMap = {
    THEME,
    create,
    stopMapPropagation,
    createLegendControl,
    initImageLightbox,
    createHoverTooltip,
    openPopup,
    openDataPopup,
    renderLoadingState,
    renderErrorState,
    createLoadingIndicator,
    parseCSV,
    fetchCSV,
  };
})(window);
