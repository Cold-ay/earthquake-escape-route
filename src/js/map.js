import L from 'leaflet';
import { CONFIG, getMagnitudeColor, calculateDangerRadius, getMagnitudeClass } from './config.js';
import { formatEarthquakeTime } from './earthquake.js';

let map = null;
let earthquakeMarkers = [];
let dangerZones = [];
let safeZone = null;
let selectedLocationMarker = null;
let routeLayer = null;
let destinationMarker = null;
let hospitalMarkers = [];
let mapClickHandler = null;

// Multi-route support
let routeLayers = [];
let routeDestinationMarkers = [];
let selectedRouteIndex = -1;

/**
 * Initialize the Leaflet map
 */
export function initializeMap(containerId = 'map', onMapClick = null) {
  map = L.map(containerId, {
    center: CONFIG.DEFAULT_CENTER,
    zoom: CONFIG.DEFAULT_ZOOM,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(map);

  L.control.scale({ position: 'bottomright' }).addTo(map);

  if (onMapClick) {
    mapClickHandler = onMapClick;
    map.on('click', handleMapClick);
  }

  return map;
}

function handleMapClick(e) {
  if (e.originalEvent.target.closest('.leaflet-marker-icon') ||
      e.originalEvent.target.closest('.leaflet-interactive')) {
    return;
  }
  
  if (mapClickHandler) {
    mapClickHandler({
      lat: e.latlng.lat,
      lng: e.latlng.lng
    });
  }
}

/**
 * Display earthquakes on map
 */
export function displayEarthquakes(earthquakes, onSelect) {
  clearEarthquakeMarkers();

  earthquakes.forEach(eq => {
    const color = getMagnitudeColor(eq.magnitude);
    const magClass = getMagnitudeClass(eq.magnitude);
    
    const marker = L.circleMarker([eq.coordinates.lat, eq.coordinates.lng], {
      radius: Math.max(8, eq.magnitude * 2),
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    });

    const popupContent = `
      <div class="earthquake-popup">
        <h4>${eq.location}</h4>
        <p class="magnitude ${magClass}">M ${eq.magnitude.toFixed(1)}</p>
        <p><strong>Depth:</strong> ${eq.depth.toFixed(1)} km</p>
        <p><strong>Time:</strong> ${formatEarthquakeTime(eq.time)}</p>
        <button class="btn btn-primary" style="margin-top: 0.5rem; padding: 0.5rem; font-size: 0.75rem;" 
                onclick="window.selectEarthquake('${eq.id}')">
          Select Earthquake
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.on('click', () => {
      if (onSelect) onSelect(eq);
    });

    marker.addTo(map);
    earthquakeMarkers.push(marker); 
  });

  if (earthquakeMarkers.length > 0) {
    const group = L.featureGroup(earthquakeMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

export function clearEarthquakeMarkers() {
  earthquakeMarkers.forEach(marker => marker.remove());
  earthquakeMarkers = [];
}

/**
 * Display danger zone around earthquake
 */
export function displayDangerZone(earthquake) {
  clearDangerZones();

  const radiusKm = calculateDangerRadius(earthquake.magnitude);
  const color = getMagnitudeColor(earthquake.magnitude);

  const dangerCircle = L.circle(
    [earthquake.coordinates.lat, earthquake.coordinates.lng],
    {
      radius: radiusKm * 1000,
      color: color,
      fillColor: color,
      fillOpacity: CONFIG.DANGER_ZONE_OPACITY,
      weight: 2,
      dashArray: '5, 10',
      interactive: false  // Allow clicks to pass through to map
    }
  );

  dangerCircle.addTo(map);
  dangerZones.push(dangerCircle);

  const safeRadiusKm = radiusKm * CONFIG.SAFE_BUFFER_MULTIPLIER;
  safeZone = L.circle(
    [earthquake.coordinates.lat, earthquake.coordinates.lng],
    {
      radius: safeRadiusKm * 1000,
      color: CONFIG.SAFE_ZONE_COLOR,
      fillColor: 'transparent',
      fillOpacity: 0,
      weight: 2,
      dashArray: '10, 5',
      interactive: false  // Allow clicks to pass through to map
    }
  );

  safeZone.addTo(map);
  map.fitBounds(safeZone.getBounds().pad(0.1));

  return { dangerCircle, safeZone, radiusKm, safeRadiusKm };
}

export function clearDangerZones() {
  dangerZones.forEach(zone => zone.remove());
  dangerZones = [];
  
  if (safeZone) {
    safeZone.remove();
    safeZone = null;
  }
}

/**
 * Set selected location marker
 */
export function setSelectedLocation(coords, isInDanger = false) {
  if (selectedLocationMarker) {
    selectedLocationMarker.remove();
  }

  const color = isInDanger ? '#ef4444' : '#3b82f6';
  const statusText = isInDanger ? 'IN DANGER ZONE' : 'Safe Location';

  const icon = L.divIcon({
    html: `<div style="
      width: 24px;
      height: 24px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
      "></div>
    </div>`,
    className: 'selected-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  selectedLocationMarker = L.marker([coords.lat, coords.lng], { icon });
  selectedLocationMarker.bindPopup(`
    <strong>Selected Location</strong><br>
    Lat: ${coords.lat.toFixed(4)}<br>
    Lng: ${coords.lng.toFixed(4)}<br>
    <span style="color: ${color}; font-weight: bold;">${statusText}</span>
  `);
  selectedLocationMarker.addTo(map);

  return selectedLocationMarker;
}

export function clearSelectedLocation() {
  if (selectedLocationMarker) {
    selectedLocationMarker.remove();
    selectedLocationMarker = null;
  }
}

/**
 * Display hospitals on map
 */
export function displayHospitals(hospitals, onSelect) {
  clearHospitals();

  hospitals.forEach(hospital => {
    const icon = L.divIcon({
      html: `<div style="
        width: 32px;
        height: 32px;
        background: #ef4444;
        border: 2px solid white;
        border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">🏥</div>`,
      className: 'hospital-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([hospital.coordinates.lat, hospital.coordinates.lng], { icon });
    
    const popupContent = `
      <div class="hospital-popup">
        <h4>🏥 ${hospital.name}</h4>
        <p><strong>Distance:</strong> ${hospital.distance.toFixed(1)} km from selected location</p>
        ${hospital.address ? `<p><strong>Address:</strong> ${hospital.address}</p>` : ''}
        <button class="btn btn-primary" style="margin-top: 0.5rem; padding: 0.5rem; font-size: 0.75rem; width: 100%;" 
                onclick="window.selectHospital('${hospital.id}')">
          Escape to This Hospital
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.on('click', () => {
      if (onSelect) onSelect(hospital);
    });

    marker.addTo(map);
    hospitalMarkers.push(marker);
  });
}

export function clearHospitals() {
  hospitalMarkers.forEach(marker => marker.remove());
  hospitalMarkers = [];
}

/**
 * Display route on map (single route - legacy support)
 */
export function displayRoute(coordinates, routeInfo, destination = null) {
  clearRoute();

  const latLngs = coordinates.map(coord => [coord[1], coord[0]]);

  routeLayer = L.polyline(latLngs, {
    color: '#8b5cf6',
    weight: 5,
    opacity: 0.8,
    lineJoin: 'round'
  });

  routeLayer.addTo(map);

  const destLatLng = latLngs[latLngs.length - 1];
  const destName = destination?.name || 'Safe Destination';
  const destType = destination?.type || 'Safe Zone';

  destinationMarker = L.marker(destLatLng, {
    icon: L.divIcon({
      html: `<div style="
        width: 36px;
        height: 36px;
        background: #22c55e;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        color: white;
        font-weight: bold;
        font-size: 18px;
      ">✓</div>`,
      className: 'dest-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    })
  });

  destinationMarker.bindPopup(`
    <strong>${destName}</strong><br>
    Type: ${destType}<br>
    Distance: ${(routeInfo.distance / 1000).toFixed(1)} km<br>
    Duration: ${Math.round(routeInfo.duration / 60)} min
  `);
  destinationMarker.addTo(map);

  map.fitBounds(routeLayer.getBounds().pad(0.1));

  return routeLayer;
}

/**
 * Display multiple routes on map with different colors
 * @param {Array} routes - Array of route objects with coordinates and color info
 * @param {Function} onRouteSelect - Callback when a route is clicked
 */
export function displayMultipleRoutes(routes, onRouteSelect = null) {
  clearAllRoutes();
  
  if (!routes || routes.length === 0) return;

  const allBounds = [];

  routes.forEach((route, index) => {
    const latLngs = route.coordinates.map(coord => [coord[1], coord[0]]);
    const color = route.color?.primary || '#3b82f6';
    const isSelected = index === selectedRouteIndex;
    
    // Create route polyline
    const polyline = L.polyline(latLngs, {
      color: color,
      weight: isSelected ? 7 : 4,
      opacity: isSelected ? 1 : 0.6,
      lineJoin: 'round',
      lineCap: 'round',
      className: `route-line route-${index}`
    });

    // Add click handler for route selection
    polyline.on('click', () => {
      selectRouteOnMap(index);
      if (onRouteSelect) onRouteSelect(route, index);
    });

    // Hover effects
    polyline.on('mouseover', () => {
      if (index !== selectedRouteIndex) {
        polyline.setStyle({ weight: 6, opacity: 0.9 });
      }
    });

    polyline.on('mouseout', () => {
      if (index !== selectedRouteIndex) {
        polyline.setStyle({ weight: 4, opacity: 0.6 });
      }
    });

    polyline.addTo(map);
    routeLayers.push(polyline);
    allBounds.push(...latLngs);

    // Create destination marker
    const destLatLng = latLngs[latLngs.length - 1];
    const destName = route.destination?.name || `Destination ${String.fromCharCode(65 + index)}`;
    const destType = route.destination?.type || 'Safe Zone';
    const routeLetter = String.fromCharCode(65 + index);

    const destMarker = L.marker(destLatLng, {
      icon: L.divIcon({
        html: `<div style="
          width: ${isSelected ? 40 : 32}px;
          height: ${isSelected ? 40 : 32}px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          color: white;
          font-weight: bold;
          font-size: ${isSelected ? 18 : 14}px;
          transition: all 0.2s;
        ">${routeLetter}</div>`,
        className: `dest-marker dest-marker-${index}`,
        iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
        iconAnchor: [isSelected ? 20 : 16, isSelected ? 20 : 16]
      })
    });

    // Popup with route metrics
    const congestionLabel = route.metrics?.congestion?.label || 'Unknown';
    const adjustedDuration = route.formatted?.adjustedDuration || '-';

    destMarker.bindPopup(`
      <div style="min-width: 180px;">
        <h4 style="margin-bottom: 0.5rem; color: ${color};">
          ${routeLetter}. ${destName}
        </h4>
        <p><strong>Type:</strong> ${destType}</p>
        <p><strong>Distance:</strong> ${route.formatted?.distance || '-'}</p>
        <p><strong>Base Time:</strong> ${route.formatted?.baseDuration || '-'}</p>
        <p><strong>With Traffic:</strong> ${adjustedDuration}</p>
        <p><strong>Traffic:</strong> <span style="color: ${route.metrics?.congestion?.color || '#666'};">${congestionLabel}</span></p>
        ${route.isFastest ? '<p style="color: #22c55e; font-weight: bold;">⭐ Fastest Route</p>' : ''}
        <button onclick="window.selectRouteById(${index})" 
                style="width: 100%; margin-top: 0.5rem; padding: 0.5rem; 
                       background: ${color}; color: white; border: none; 
                       border-radius: 0.375rem; cursor: pointer; font-weight: 500;">
          Select This Route
        </button>
      </div>
    `);

    destMarker.on('click', () => {
      selectRouteOnMap(index);
      if (onRouteSelect) onRouteSelect(route, index);
    });

    destMarker.addTo(map);
    routeDestinationMarkers.push(destMarker);
  });

  // Fit map to show all routes
  if (allBounds.length > 0) {
    const bounds = L.latLngBounds(allBounds);
    map.fitBounds(bounds.pad(0.15));
  }
}

/**
 * Select/highlight a specific route on the map
 * @param {number} index - Route index to select
 */
export function selectRouteOnMap(index) {
  selectedRouteIndex = index;

  // Update route line styles
  routeLayers.forEach((layer, i) => {
    if (i === index) {
      layer.setStyle({ weight: 7, opacity: 1 });
      layer.bringToFront();
    } else {
      layer.setStyle({ weight: 4, opacity: 0.5 });
    }
  });

  // Update destination marker styles
  routeDestinationMarkers.forEach((marker, i) => {
    const isSelected = i === index;
    const size = isSelected ? 40 : 32;
    const fontSize = isSelected ? 18 : 14;
    
    // Get color from the route layer
    const color = routeLayers[i]?.options?.color || '#3b82f6';
    const letter = String.fromCharCode(65 + i);

    marker.setIcon(L.divIcon({
      html: `<div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,${isSelected ? 0.4 : 0.3});
        color: white;
        font-weight: bold;
        font-size: ${fontSize}px;
        transition: all 0.2s;
        ${isSelected ? 'transform: scale(1.1);' : ''}
      ">${letter}</div>`,
      className: `dest-marker dest-marker-${i}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    }));
  });
}

/**
 * Clear all multi-route layers
 */
export function clearAllRoutes() {
  // Clear route polylines
  routeLayers.forEach(layer => layer.remove());
  routeLayers = [];

  // Clear destination markers
  routeDestinationMarkers.forEach(marker => marker.remove());
  routeDestinationMarkers = [];

  selectedRouteIndex = -1;

  // Also clear single route layers for compatibility
  clearRoute();
}

export function clearRoute() {
  if (routeLayer) {
    routeLayer.remove();
    routeLayer = null;
  }
  
  if (destinationMarker) {
    destinationMarker.remove();
    destinationMarker = null;
  }
}

export function centerMap(coords, zoom = 10) {
  map.setView([coords.lat, coords.lng], zoom);
}
