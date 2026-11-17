# U.S. Flight Network Explorer

**[Open the live explorer](https://nickfog123.github.io/isc4221-flight-network/)**

Explore U.S. airports, major airline hubs, and connections using
OpenFlights’ 2014 route dataset. Search for an airport, inspect its
direct connections, and find the fewest flights between two airports
in the recorded network.

The hosted app runs in your browser—no installation required.

## What you can explore

- **Interactive map:** Select airports to highlight their routes,
  with views for the lower 48, Alaska, Hawaii, and the full network.
- **Airport lookup:** Search by IATA code to see an airport’s direct
  connections, five nearest network airports, and binary-search
  comparison count.
- **Network statistics:** Explore the largest hubs, connected
  components, and minimum flight counts from Tallahassee.
- **Connection checker:** Choose two airports to check reachability,
  see the fewest flights, and inspect the search iterations.
- **Search performance:** Compare sequential and binary search
  using 10,000 reproducible queries.

## Try it

1. Open the live explorer.
2. Search for `TLH` to inspect Tallahassee’s connections.
3. Check `TLH` to `SEA` for a connected example.
4. Check `TLH` to `AKB` for a disconnected example.
5. Select a hub or connected component to highlight it on the map.

## About the data

The network uses historical OpenFlights route data from 2014.
Routes are treated as undirected connections, with duplicate
routes and self-loops removed.

The main explorer includes airports with at least one domestic
route. A missing airport or connection does not mean it is
unavailable today.

This project explores network structure. It does not provide
current schedules, fares, booking, or flight status.
