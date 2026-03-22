# Earthquake Escape Route Navigator

`Earthquake Escape Route Navigator` is a browser-based emergency mapping app built with `Vite`, `Vanilla JavaScript`, and `Leaflet`. It helps a user load recent earthquake events, inspect danger zones, choose their current position, locate nearby hospitals, and calculate escape routes to either generated safe zones or a selected hospital.

The project is designed as a front-end only app. It does not require any private API keys because it uses public data and routing services.

## Project Goal

The app answers one practical question:

"If an earthquake happens near my location, where should I go, and what is the best route to get out of the danger zone?"

It does this by combining:

- live earthquake event data
- map-based location selection
- danger-radius estimation
- nearby hospital lookup
- road route calculation
- route comparison with congestion and safety scoring

## Main User Flow

The application flow is:

1. The app starts and automatically loads recent earthquakes.
2. The user selects one earthquake from the map or popup.
3. The app draws a danger zone and a larger safe buffer around the epicenter.
4. The user selects their location by clicking on the map or using GPS.
5. The app checks whether the location is inside the danger zone.
6. If the user is in danger, they can:
   - find nearby hospitals, then route directly to a selected hospital
   - skip hospital selection and compare multiple generated safe-zone routes
7. The app displays route metrics such as distance, base duration, adjusted duration, congestion, and safety score.
8. The user can refresh routes to recalculate route conditions.
9. The user can clear all selections and restart the process.

## Runtime Flow By Module

### `src/js/main.js`

This is the application entry point and state coordinator.

Responsibilities:

- initializes the map and UI
- stores application state
- auto-loads earthquakes on startup
- handles user actions such as:
  - fetching earthquakes
  - choosing GPS/current map location
  - finding hospitals
  - calculating routes
  - refreshing routes
  - clearing the app

### `src/js/ui.js`

This module manages the control panel and information cards.

Responsibilities:

- binds button and select events
- updates status messages
- displays selected earthquake details
- displays selected location details
- shows hospital list and selected hospital
- renders route comparison cards
- shows selected route metrics

### `src/js/map.js`

This module manages all Leaflet map rendering.

Responsibilities:

- creates the map
- renders earthquake markers
- draws danger and safe circles
- places the selected user marker
- renders hospital markers
- renders single or multiple route polylines
- highlights the selected route on the map

### `src/js/earthquake.js`

This module fetches and parses earthquake data from the USGS API.

Responsibilities:

- requests earthquake GeoJSON data
- applies time range and minimum magnitude filters
- converts API responses into app-friendly objects
- caches recent results for 5 minutes

### `src/js/facilities.js`

This module fetches nearby hospitals using OpenStreetMap Overpass.

Responsibilities:

- searches for hospitals around the selected earthquake area
- parses map elements into hospital objects
- calculates distance from the epicenter
- caches recent results for 10 minutes

### `src/js/routing.js`

This module handles road-route calculation through OSRM.

Responsibilities:

- requests route geometry, distance, and duration
- supports `car`, `foot`, and `bike` travel modes
- parses route steps and annotations
- falls back to a straight-line estimated route if OSRM fails

### `src/js/multiRoute.js`

This module compares route options.

Responsibilities:

- generates alternative safe-zone destinations
- calculates multiple routes in parallel
- estimates congestion
- adjusts travel time based on congestion
- calculates a safety score
- recommends a best route

The route comparison now uses live traffic flow from `TomTom` when `VITE_TOMTOM_API_KEY` is configured. If live traffic is unavailable, the app falls back to the built-in congestion estimation model.

### `src/js/config.js`

This module contains shared configuration and helper logic.

Responsibilities:

- stores API endpoints and map defaults
- stores magnitude color rules
- calculates an estimated danger radius from earthquake magnitude

## User Interface Tools And How To Use Them

The control panel is organized into a step-by-step workflow.

### `1. Load Earthquakes`

Purpose:

- fetch recent earthquake events from the public USGS feed

Controls:

- `Time Range`
  - `Last 24 Hours`
  - `Last 7 Days`
  - `Last 30 Days`
- `Min Magnitude`
  - `2.5+`
  - `4.5+`
  - `5.5+`
  - `6.5+`
- `Fetch Earthquakes`

How to use:

1. Choose a time range.
2. Choose a minimum magnitude.
3. Click `Fetch Earthquakes`.
4. Click an earthquake marker or use its popup button to select it.

Result:

- earthquake markers appear on the map
- selected earthquake information is shown
- the app draws the danger zone and safe buffer

### `2. Select Location`

Purpose:

- define the user's current position

Controls:

- click directly on the map
- `Use My GPS Location`

How to use:

1. Either click a point on the map or press `Use My GPS Location`.
2. The app places a location marker.
3. The app checks whether the selected point is inside the selected earthquake danger zone.

Result:

- the app shows coordinates
- the app shows whether the position is in danger
- the app shows the distance from the epicenter

### `3. Find Hospitals`

Purpose:

- locate nearby hospitals around the earthquake region

Controls:

- `Find Nearby Hospitals`
- hospital cards in the control panel
- hospital markers and popup buttons on the map

How to use:

1. Select an earthquake first.
2. Click `Find Nearby Hospitals`.
3. Review the hospital list.
4. Click a hospital in the side panel or on the map to select it.

Result:

- hospitals are displayed on the map
- the selected hospital becomes the direct evacuation destination
- route calculation will use this hospital if one is selected

### `4. Calculate Routes`

Purpose:

- calculate evacuation routes from the selected user location

Controls:

- `Travel Mode`
  - `Driving`
  - `Walking`
  - `Cycling`
- `Find Escape Routes`
- `Clear All`

How route behavior works:

- if a hospital is selected:
  - the app calculates a single direct route to that hospital
- if no hospital is selected:
  - the app generates multiple safe-zone destinations and compares several route options

Requirements before this works:

- an earthquake must be selected
- a location must be selected
- the location must be inside the earthquake danger zone

Result:

- routes appear on the map
- route metrics are displayed
- the route comparison panel appears for multi-route mode

### `Escape Routes` Comparison Panel

Purpose:

- compare route alternatives and choose the best option

Displayed information:

- number of routes
- fastest route
- shortest route
- route cards with:
  - distance
  - base time
  - traffic-adjusted time
  - safety score
  - congestion level

How to use:

1. Click any route card or route line on the map.
2. Review the selected route details.
3. Click `Refresh Traffic Data` to recalculate route conditions.

### `Clear All`

Purpose:

- reset the application and remove current selections

What it clears:

- selected earthquake
- danger zone
- selected location
- hospitals
- all route layers
- route comparison and detail panels

## External Tools, Libraries, And Services

### Framework / Build Tool

- `Vite`
  - runs the dev server
  - builds the production bundle

### Map Library

- `Leaflet`
  - renders the interactive map
  - draws markers, circles, and route lines

### Basemap Provider

- `OpenStreetMap` tiles
  - used as the visual base map layer

### Earthquake Data Source

- `USGS Earthquake API`
  - provides public earthquake event data in GeoJSON format

### Hospital Search Service

- `OpenStreetMap Overpass API`
  - searches hospitals near the earthquake area

### Routing Service

- `OSRM`
  - calculates road-based routes
  - supports driving, walking, and cycling

### Live Traffic Service

- `TomTom Traffic Flow API`
  - provides live traffic flow data near sampled points along each route
  - is used to estimate route congestion and traffic-adjusted duration

### Browser APIs

- `Geolocation API`
  - gets the user's current location when permission is allowed

## Tech Stack

- `HTML`
- `CSS`
- `Vanilla JavaScript (ES Modules)`
- `Vite`
- `Leaflet`

## Project Structure

```text
earthquake-escape-route/
├─ index.html
├─ package.json
├─ vite.config.js
├─ src/
│  ├─ css/
│  │  └─ styles.css
│  └─ js/
│     ├─ main.js
│     ├─ ui.js
│     ├─ map.js
│     ├─ earthquake.js
│     ├─ facilities.js
│     ├─ routing.js
│     ├─ multiRoute.js
│     └─ config.js
└─ README.md
```

## Setup And Run

### Prerequisites

- `Node.js` 18+ recommended
- `npm`

### Install

```bash
npm install
```

### Configure Live Traffic

Create a local environment file from `.env.example` and set:

```bash
VITE_TOMTOM_API_KEY=your_tomtom_api_key_here
```

### Start Development Server

```bash
npm run dev
```

By default, Vite runs on:

- `http://localhost:5173`

### Build For Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## How To Demonstrate The Project

For a quick demonstration:

1. Run `npm install`.
2. Run `npm run dev`.
3. Open the app in the browser.
4. Click `Fetch Earthquakes` if data is not already loaded.
5. Select an earthquake marker.
6. Click on the map to set a location inside the visible danger zone.
7. Press `Find Escape Routes` to compare multiple safe-zone routes.
8. Press `Find Nearby Hospitals`, select one hospital, and calculate a direct hospital route.
9. Switch travel mode between driving, walking, and cycling to compare behavior.

## Important Notes And Limitations

- The app is front-end only and depends on third-party public services.
- Hospital data quality depends on OpenStreetMap coverage in the selected region.
- Route quality depends on the public OSRM service and may fall back to estimated straight-line routing if the service is unavailable.
- Live traffic depends on TomTom API availability and a valid `VITE_TOMTOM_API_KEY`.
- If the traffic API is unavailable, the app falls back to the built-in congestion estimation logic.
- The danger radius is an estimated formula based on magnitude and may need domain validation for academic or real emergency use.