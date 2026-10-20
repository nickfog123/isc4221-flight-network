/* Presentation and map interactions. Network algorithms live in algorithms.js. */
(function () {
  "use strict";
  const A = window.FlightAlgorithms;
  const $ = id => document.getElementById(id);
  const number = value => Number(value).toLocaleString("en-US");
  let data, adjacency, map, routeLayer, highlightLayer, airportLayer;
  let selected = "TLH";
  let reached = new Set();
  let componentSelected = null;
  const markers = new Map();
  const regions = {
    mainland: [[24, -125], [50, -66]],
    alaska: [[51, -181], [72, -129]],
    hawaii: [[18.3, -161.5], [23, -154]],
    all: [[17, -190], [73, -64]]
  };

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function airportButton(code, className = "airport-chip") {
    const button = node("button", className, code);
    button.type = "button";
    button.title = `${data.airports[code].name} — ${data.airports[code].city}`;
    button.setAttribute("aria-label", `Select ${code}, ${data.airports[code].city}`);
    button.addEventListener("click", () => selectAirport(code, true));
    return button;
  }

  // Keep the Aleutians alongside Alaska instead of across the world at +170°.
  function coordinates(code) {
    const airport = data.airports[code];
    return [airport.lat, airport.lon > 0 ? airport.lon - 360 : airport.lon];
  }

  function fitPoints(codes, maximumZoom = 7) {
    if (!map || codes.length === 0) return;
    const bounds = L.latLngBounds(codes.map(coordinates));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: maximumZoom, animate: false });
    document.querySelectorAll("[data-region]").forEach(button => {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    });
  }

  function styleAirports() {
    if (!map) return;
    for (const [code, marker] of markers) {
      const isSelected = code === selected;
      const isReached = reached.has(code);
      const color = isSelected ? "#d96b28" : isReached ? "#147d79" : "#2e6a9d";
      marker.setStyle({ color: isSelected ? "#ffffff" : color, fillColor: color,
        weight: isSelected ? 2 : .5, fillOpacity: isSelected || isReached ? 1 : .72,
        opacity: 1 });
      marker.setRadius(isSelected ? 8 : 2.4 + Math.sqrt(data.airports[code].degree) * .4);
    }
    for (const code of reached) markers.get(code)?.bringToFront();
    if (selected) markers.get(selected)?.bringToFront();
  }

  function clearComponentSelection() {
    componentSelected = null;
    document.querySelectorAll(".component-button").forEach(button => {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    });
  }

  function closeTooltips() {
    for (const marker of markers.values()) marker.closeTooltip();
  }

  function drawSelectedRoutes(code) {
    if (!map) return;
    highlightLayer.clearLayers();
    for (const neighbor of adjacency.get(code)) {
      L.polyline([coordinates(code), coordinates(neighbor)], {
        pane: "highlight-routes", color: "#d96b28", weight: 2, opacity: .9, interactive: false
      }).addTo(highlightLayer);
    }
  }

  function initializeMap() {
    if (!window.L) {
      $("map-fallback").hidden = false;
      return;
    }
    map = L.map("map", { preferCanvas: true, zoomControl: true, minZoom: 2, maxZoom: 12,
      worldCopyJump: false, scrollWheelZoom: false, attributionControl: true });
    map.createPane("base-routes");
    map.getPane("base-routes").style.zIndex = 350;
    map.createPane("highlight-routes");
    map.getPane("highlight-routes").style.zIndex = 410;
    map.createPane("airport-points");
    map.getPane("airport-points").style.zIndex = 430;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    let warnedAboutTiles = false;
    tiles.on("tileerror", () => {
      if (!warnedAboutTiles) {
        warnedAboutTiles = true;
        $("map-caption").textContent = "Some basemap tiles could not load. Airport locations, routes, and lookup remain available.";
      }
    });
    routeLayer = L.layerGroup().addTo(map);
    highlightLayer = L.layerGroup().addTo(map);
    airportLayer = L.layerGroup().addTo(map);
    for (const [a, b] of data.edges) {
      L.polyline([coordinates(a), coordinates(b)], {
        pane: "base-routes", color: "#356b99", opacity: .075, weight: .65, interactive: false
      }).addTo(routeLayer);
    }
    for (const code of data.codes) {
      const airport = data.airports[code];
      const tooltip = node("div");
      tooltip.append(node("strong", "", code), node("span", "", ` · ${airport.city}`));
      tooltip.append(node("div", "", `${airport.degree} direct destinations`));
      const marker = L.circleMarker(coordinates(code), { pane: "airport-points",
        radius: 2.4 + Math.sqrt(airport.degree) * .4, weight: .5, color: "#2e6a9d",
        fillColor: "#2e6a9d", fillOpacity: .72 });
      marker.bindTooltip(tooltip, { direction: "top" });
      marker.on("click", () => selectAirport(code, false));
      marker.addTo(airportLayer);
      markers.set(code, marker);
    }
    setRegion("mainland");
    // Resize the map after layout changes without resetting the current view.
    if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize({ pan: false })).observe($("map"));
  }

  function setRegion(region) {
    if (map) map.fitBounds(regions[region], { padding: [12, 12], animate: false });
    document.querySelectorAll("[data-region]").forEach(button => {
      const active = button.dataset.region === region;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderAirport(airport, search) {
    const container = $("airport-result");
    container.replaceChildren();
    const heading = node("div", "airport-card-heading");
    const description = node("div");
    description.append(node("h3", "", airport.name), node("p", "", `${airport.city}, United States`));
    heading.append(node("div", "airport-big-code", airport.code), description);
    const stats = node("div", "lookup-stats");
    const degree = node("span");
    degree.append(node("strong", "", airport.degree), document.createTextNode(" direct destinations"));
    stats.append(degree, node("span", "comparison-pill", `${search.comparisons} binary comparisons`));
    container.append(heading, stats, node("span", "tiny-label", "DIRECT DESTINATIONS"));
    const destinations = node("div", "destination-list");
    const neighbors = adjacency.get(airport.code).slice().sort();
    for (const code of neighbors) destinations.append(airportButton(code));
    container.append(destinations, node("span", "tiny-label", "5 NEAREST AIRPORTS · GREAT-CIRCLE DISTANCE"));
    const nearest = node("ol", "nearest-list");
    for (const candidate of A.nearestAirports(data.airports, airport.code, 5)) {
      const item = node("li");
      const name = node("span");
      name.append(airportButton(candidate.code, ""), node("span", "city", data.airports[candidate.code].city));
      item.append(name, node("span", "distance", `${candidate.distance.toFixed(2)} km`));
      nearest.append(item);
    }
    container.append(nearest);
    const details = node("details", "trace-details");
    details.append(node("summary", "", "See binary search steps"));
    const table = node("table");
    table.append(node("caption", "", `Final index: ${search.index} · alphabetically sorted network codes`));
    const head = node("thead");
    const tr = node("tr");
    for (const label of ["Low", "High", "Mid", "Code"]) tr.append(node("th", "", label));
    head.append(tr);
    table.append(head);
    const body = node("tbody");
    for (const step of search.trace) {
      const row = node("tr");
      for (const value of [step.low, step.high, step.mid, step.code]) row.append(node("td", "", value));
      body.append(row);
    }
    table.append(body);
    details.append(table);
    container.append(details);
  }

  function selectAirport(rawCode, moveMap) {
    closeTooltips();
    const code = rawCode.trim().toUpperCase();
    $("airport-code").value = code;
    const search = A.binarySearch(data.codes, code);
    if (search.index === -1) {
      selected = null;
      reached = new Set();
      clearComponentSelection();
      highlightLayer?.clearLayers();
      styleAirports();
      document.querySelectorAll(".hub-bar").forEach(button => button.classList.remove("selected"));
      const box = node("div", "lookup-error");
      box.append(node("h3", "", `Airport “${code || "(empty)"}” not found`),
        node("p", "", `${search.comparisons} binary-search comparisons · final index −1.`),
        node("p", "", "Search covers airports with domestic routes in this dataset. Try TLH, ATL, or SEA."));
      $("airport-result").replaceChildren(box);
      $("map-caption").textContent = "No airport selected. Enter a network airport code to highlight its routes.";
      return;
    }
    selected = code;
    reached = new Set();
    clearComponentSelection();
    renderAirport(data.airports[code], search);
    drawSelectedRoutes(code);
    styleAirports();
    document.querySelectorAll(".hub-bar").forEach(button => button.classList.toggle("selected", button.dataset.code === code));
    const airport = data.airports[code];
    $("map-caption").textContent = `${code} · ${airport.city} · ${airport.degree} direct destinations. Orange lines show its direct routes. All distances are in kilometers.`;
    if (moveMap && map) {
      fitPoints([code, ...adjacency.get(code)], 7);
      markers.get(code).openTooltip();
    }
  }

  function renderSummary() {
    const s = data.summary;
    $("stat-airports").textContent = number(s.network_airports);
    $("stat-edges").textContent = number(s.edges);
    $("stat-components").textContent = number(s.components);
    $("dataset-counts").textContent = `${number(s.us_airports)} U.S. airports in the source · ${number(s.no_domestic_route)} with no domestic route · ${number(s.domestic_route_lines)} domestic route rows before deduplication.`;
    const largest = data.hubs[0].degree;
    for (const [i, hub] of data.hubs.entries()) {
      const bar = node("button", "hub-bar");
      bar.type = "button";
      bar.dataset.code = hub.code;
      bar.setAttribute("aria-label", `Select ${hub.code}, ${hub.degree} direct destinations`);
      const track = node("span", "bar-track");
      const fill = node("span", "bar-fill");
      fill.style.width = `${hub.degree / largest * 100}%`;
      track.append(fill);
      bar.append(node("span", "hub-rank", String(i + 1).padStart(2, "0")), node("span", "hub-code", hub.code),
        track, node("span", "hub-count", hub.degree));
      bar.addEventListener("click", () => selectAirport(hub.code, true));
      $("hub-chart").append(bar);
    }

    data.components.forEach((component, i) => {
      const label = i === 0 ? "Largest component" : component.join(" · ");
      const button = node("button", "component-button", label);
      button.type = "button";
      button.append(node("span", "", `${component.length} airports`));
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        closeTooltips();
        clearComponentSelection();
        componentSelected = i;
        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");
        selected = null;
        reached = new Set(component);
        highlightLayer?.clearLayers();
        document.querySelectorAll(".hub-bar").forEach(bar => bar.classList.remove("selected"));
        styleAirports();
        fitPoints(component, 7);
        const places = i > 0 ? component.map(code => `${code} (${data.airports[code].city})`).join(", ") : "The main network";
        $("map-caption").textContent = `Component ${i + 1}: ${component.length} airports highlighted in teal. ${places}.`;
      });
      $("components").append(button);
    });

    const maximumCount = Math.max(...data.tlh_flights.counts.map(row => row.airports));
    for (const row of data.tlh_flights.counts) {
      const line = node("div", "flight-row");
      const track = node("span", "bar-track");
      const fill = node("span", "bar-fill");
      fill.style.width = `${row.airports / maximumCount * 100}%`;
      track.append(fill);
      line.append(node("span", "", `${row.flights} flight${row.flights === 1 ? "" : "s"}`), track, node("span", "", row.airports));
      line.setAttribute("aria-label", `${row.airports} airports need ${row.flights} flights from TLH`);
      $("flight-chart").append(line);
    }
    $("farthest-airports").textContent = `${data.tlh_flights.reachable} airports are reachable from TLH, including TLH itself. Most flights: ${data.tlh_flights.maximum}. Airports at that distance: ${data.tlh_flights.farthest.map(code => `${code} (${data.airports[code].city})`).join(", ")}. Unreachable airports are excluded from this chart.`;

    for (const row of data.benchmark.rows) {
      const tr = node("tr");
      for (const text of [row.method, row.queries, (row.seconds * 1000).toFixed(2), row.average.toFixed(2), row.maximum]) tr.append(node("td", "", text));
      $("benchmark-rows").append(tr);
    }
    const theory = data.search_theory;
    $("search-theory").textContent = `For n = ${theory.n}, binary search is O(log n) and needs at most ${theory.binary_maximum} comparisons. Sequential search is O(n): expected valid-query average ${(theory.sequential_valid_average).toFixed(1)}; invalid queries need ${theory.sequential_invalid}.`;
    const b = data.benchmark;
    const breakEven = b.break_even === null ? "The measured binary search did not produce a positive time saving on this run." : `Estimated sorting break-even: ${number(b.break_even)} lookups for this 50/50 query mix.`;
    $("benchmark-note").textContent = `Python selection-sort time: ${(b.sort_seconds * 1000).toFixed(2)} ms. ${breakEven} These measurements were captured on export; browser timings and other computers will differ.`;
    $("validation-note").textContent = `Degree-sum check: ${number(s.degree_sum)} = 2 × ${number(s.edges)}. Component sizes add to ${number(s.network_airports)}. Example airports without domestic routes: ${s.no_route_examples.map(airport => airport.code).join(", ")}.`;
    $("repository-link").href = data.metadata.repository_url;
    $("report-link").href = data.metadata.report_url;
  }

  function checkConnection() {
    closeTooltips();
    const origin = $("origin").value;
    const destination = $("destination").value;
    // Run the real algorithm on every button press; exported examples are never used here.
    const result = A.connectionSearch(adjacency, origin, destination);
    const answer = node("div", `connection-answer${result.found ? "" : " no-path"}`);
    answer.append(node("div", "answer-title", result.found ? "✓ Path exists" : "× No path"),
      node("p", "answer-pair", `${origin} → ${destination}`));
    const stats = node("div", "answer-metrics");
    const iterations = node("div");
    iterations.append(node("strong", "", result.iterations), node("span", "", `iteration${result.iterations === 1 ? "" : "s"}`));
    stats.append(iterations);
    if (result.found) {
      const flights = node("div");
      const count = result.flights[destination];
      flights.append(node("strong", "", count), node("span", "", `fewest flight${count === 1 ? "" : "s"}`));
      stats.append(flights);
    }
    const reachedCount = node("div");
    reachedCount.append(node("strong", "", result.reached.length), node("span", "", "airports reached"));
    stats.append(reachedCount);
    answer.append(stats);
    if (result.found) answer.append(node("p", "answer-route", result.path.join(" → ")));
    answer.append(node("p", "answer-note", result.found
      ? "One shortest route is shown in orange. Teal airports were reached when the destination was discovered."
      : `The origin’s component was fully explored. ${result.untouched} airports remain untouched; the destination is in a separate component.`));
    const details = node("details", "trace-details");
    details.append(node("summary", "", "See connection algorithm iterations"));
    const explanation = node("p", "summary-note", "Each iteration explores the complete current frontier. Newly discovered airports become the next frontier. A final empty frontier proves that no path exists.");
    details.append(explanation);
    if (result.layers.length) {
      const table = node("table");
      const head = node("thead");
      const tr = node("tr");
      for (const value of ["Iteration", "New", "Used", "Untouched"]) tr.append(node("th", "", value));
      head.append(tr);
      table.append(head);
      const body = node("tbody");
      for (const layer of result.layers) {
        const row = node("tr");
        for (const value of [layer.iteration, layer.discovered, layer.used, layer.untouched]) row.append(node("td", "", value));
        body.append(row);
      }
      table.append(body);
      details.append(table);
    } else details.append(node("p", "summary-note", "Origin and destination are identical. No flights or exploration iterations are needed."));
    $("connection-result").replaceChildren(answer, details);
    selected = null;
    reached = new Set(result.reached);
    clearComponentSelection();
    document.querySelectorAll(".hub-bar").forEach(button => button.classList.remove("selected"));
    if (map) {
      highlightLayer.clearLayers();
      if (result.path.length > 1) L.polyline(result.path.map(coordinates), {
        pane: "highlight-routes", color: "#d96b28", weight: 3, opacity: 1, interactive: false
      }).addTo(highlightLayer);
      styleAirports();
      // Include the full explored set, even when the destination is disconnected.
      fitPoints([...result.reached, destination], 7);
    }
    $("map-caption").textContent = `${origin} → ${destination}: ${result.found ? "path exists" : "no path"}; ${result.iterations} iterations; ${result.reached.length} airports reached (teal).${result.found ? ` Fewest flights: ${result.flights[destination]}.` : ""}`;
  }

  function wireEvents() {
    $("lookup-form").addEventListener("submit", event => {
      event.preventDefault();
      selectAirport($("airport-code").value, true);
    });
    $("connection-form").addEventListener("submit", event => {
      event.preventDefault();
      checkConnection();
    });
    document.querySelectorAll("[data-region]").forEach(button => button.addEventListener("click", () => setRegion(button.dataset.region)));
    $("show-routes").addEventListener("change", event => {
      if (!map) return;
      if (event.target.checked) routeLayer.addTo(map);
      else map.removeLayer(routeLayer);
    });
    document.querySelectorAll("[data-origin]").forEach(button => button.addEventListener("click", () => {
      $("origin").value = button.dataset.origin;
      $("destination").value = button.dataset.destination;
      checkConnection();
    }));
    for (const id of ["origin", "destination"]) {
      $(id).replaceChildren();
      for (const code of data.codes) {
        const option = node("option", "", `${code} – ${data.airports[code].city}`);
        option.value = code;
        $(id).append(option);
      }
      $(id).disabled = false;
    }
    $("origin").value = "TLH";
    $("destination").value = "SEA";
    document.querySelectorAll(".primary-button").forEach(button => { button.disabled = false; });
  }

  async function start() {
    try {
      const response = await fetch("data/network.json");
      if (!response.ok) throw new Error(`Network data returned HTTP ${response.status}.`);
      data = await response.json();
      if (!data.codes || !data.airports || !data.edges || !data.summary) throw new Error("The exported network data is incomplete.");
      adjacency = A.makeAdjacency(data.codes, data.edges);
      renderSummary();
      initializeMap();
      wireEvents();
      selectAirport("TLH", false);
      $("load-status").hidden = true;
    } catch (error) {
      const localFile = location.protocol === "file:";
      $("load-status").textContent = localFile
        ? "To preview this website, open a terminal in the project folder, run: py -3 -m http.server 8000 --directory docs — then open http://localhost:8000. Double-clicking index.html cannot load the JSON data."
        : `The network could not load. Check that data/network.json was uploaded with the website, then refresh. ${error.message}`;
      $("load-status").classList.add("error");
      $("load-status").hidden = false;
    }
  }
  start();
})();
