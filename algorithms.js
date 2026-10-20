/* Browser versions of the lab algorithms. Also usable in Node for parity checks. */
(function (root) {
  "use strict";

  function binarySearch(codes, code) {
    let low = 0;
    let high = codes.length - 1;
    let comparisons = 0;
    const trace = [];
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      comparisons += 1;
      trace.push({ low, high, mid, code: codes[mid] });
      if (codes[mid] === code) return { index: mid, comparisons, trace };
      if (codes[mid] < code) low = mid + 1;
      else high = mid - 1;
    }
    return { index: -1, comparisons, trace };
  }

  function haversine(a, b) {
    const radians = angle => angle * Math.PI / 180;
    const lat1 = radians(a.lat);
    const lat2 = radians(b.lat);
    const dlat = lat2 - lat1;
    const dlon = radians(b.lon - a.lon);
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  }

  function nearestAirports(airports, code, k = 5) {
    const origin = airports[code];
    if (!origin) return [];
    const values = Object.keys(airports).filter(candidate => candidate !== code)
      .map(candidate => ({ code: candidate, distance: haversine(origin, airports[candidate]) }));
    // Selection sort, like the student's Python. Sort only the first k positions.
    for (let i = 0; i < Math.min(k, values.length); i++) {
      let minimum = i;
      for (let j = i + 1; j < values.length; j++) {
        if (values[j].distance < values[minimum].distance ||
            (values[j].distance === values[minimum].distance && values[j].code < values[minimum].code)) minimum = j;
      }
      [values[i], values[minimum]] = [values[minimum], values[i]];
    }
    return values.slice(0, k);
  }

  function makeAdjacency(codes, edges) {
    const adjacency = new Map(codes.map(code => [code, []]));
    for (const [a, b] of edges) {
      adjacency.get(a).push(b);
      adjacency.get(b).push(a);
    }
    return adjacency;
  }

  function connectionSearch(adjacency, origin, destination) {
    const empty = { found: false, iterations: 0, reached: [], flights: {}, path: [], layers: [], untouched: adjacency.size };
    if (!adjacency.has(origin) || !adjacency.has(destination)) return empty;
    // These are the same three sets as connection_search() in answers_lab.py.
    const used = new Set();
    let newlyFound = new Set([origin]);
    const untouched = new Set(adjacency.keys());
    untouched.delete(origin);
    const flights = { [origin]: 0 };
    const parent = { [origin]: null };
    const layers = [];
    let iterations = 0;
    let found = origin === destination;

    while (!found && newlyFound.size > 0) {
      iterations += 1;
      const nextNew = new Set();
      // Finish the entire frontier before checking the destination, matching Python.
      for (const current of newlyFound) {
        for (const neighbor of adjacency.get(current)) {
          if (untouched.has(neighbor)) {
            nextNew.add(neighbor);
            untouched.delete(neighbor);
            flights[neighbor] = iterations;
            parent[neighbor] = current;
          }
        }
        used.add(current);
      }
      newlyFound = nextNew;
      layers.push({ iteration: iterations, discovered: nextNew.size, used: used.size, untouched: untouched.size });
      found = newlyFound.has(destination);
    }

    const path = [];
    if (found) {
      for (let current = destination; current !== null; current = parent[current]) path.push(current);
      path.reverse();
    }
    return { found, iterations, reached: [...new Set([...used, ...newlyFound])],
      flights, path, layers, untouched: untouched.size };
  }

  const api = { binarySearch, haversine, nearestAirports, makeAdjacency, connectionSearch };
  root.FlightAlgorithms = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
