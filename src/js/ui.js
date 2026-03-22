import { formatEarthquakeTime } from './earthquake.js';
import { calculateDangerRadius } from './config.js';
import { formatDistance, formatDuration } from './routing.js';
import { ROUTE_COLORS } from './multiRoute.js';

let elements = {};
let routeSelectHandler = null;

/**
 * Initialize UI elements and event listeners
 */
export function initializeUI(handlers) {
  elements = {
    statusIndicator: document.getElementById('status-indicator'),
    controlPanel: document.getElementById('control-panel'),
    togglePanel: document.getElementById('toggle-panel'),
    mobileToggle: document.getElementById('mobile-toggle'),
    
    timeFilter: document.getElementById('time-filter'),
    magnitudeFilter: document.getElementById('magnitude-filter'),
    travelMode: document.getElementById('travel-mode'),
    
    fetchEarthquakesBtn: document.getElementById('fetch-earthquakes'),
    getLocationBtn: document.getElementById('get-location'),
    clearRouteBtn: document.getElementById('clear-route'),
    calculateEscapeBtn: document.getElementById('calculate-escape'),
    findHospitalsBtn: document.getElementById('find-hospitals'),
    
    earthquakeCount: document.getElementById('earthquake-count'),
    earthquakeInfo: document.getElementById('earthquake-info'),
    locationInfo: document.getElementById('location-info'),
    hospitalsInfo: document.getElementById('hospitals-info'),
    routeInfo: document.getElementById('route-info'),
    
    eqLocation: document.getElementById('eq-location'),
    eqMagnitude: document.getElementById('eq-magnitude'),
    eqDepth: document.getElementById('eq-depth'),
    eqTime: document.getElementById('eq-time'),
    eqDangerRadius: document.getElementById('eq-danger-radius'),
    
    locCoords: document.getElementById('loc-coords'),
    locStatus: document.getElementById('loc-status'),
    locDistance: document.getElementById('loc-distance'),
    
    hospitalsList: document.getElementById('hospitals-list'),
    hospitalsCount: document.getElementById('hospitals-count'),
    selectedHospitalName: document.getElementById('selected-hospital-name'),
    
    routeDistance: document.getElementById('route-distance'), 
    routeDuration: document.getElementById('route-duration'),
    routeDestination: document.getElementById('route-destination'),
    routeStatus: document.getElementById('route-status'),
    
    // Multi-route comparison elements
    routesComparisonSection: document.getElementById('routes-comparison-section'),
    routesSummary: document.getElementById('routes-summary'),
    summaryRoutes: document.getElementById('summary-routes'),
    summaryFastest: document.getElementById('summary-fastest'),
    summaryShortest: document.getElementById('summary-shortest'),
    routesList: document.getElementById('routes-list'),
    refreshRoutesBtn: document.getElementById('refresh-routes'),
    routesLegend: document.getElementById('routes-legend'),
    
    // Extended route info
    routeAdjustedDuration: document.getElementById('route-adjusted-duration'),
    routeCongestion: document.getElementById('route-congestion'),
    routeSafety: document.getElementById('route-safety')
  };

  setupEventListeners(handlers);
  updateStatus('Ready - Click on map to select location');
}

function setupEventListeners(handlers) {
  elements.togglePanel?.addEventListener('click', toggleControlPanel);
  elements.mobileToggle?.addEventListener('click', toggleControlPanel);

  elements.fetchEarthquakesBtn?.addEventListener('click', () => {
    handlers.onFetchEarthquakes?.(getFilterValues());
  });

  elements.getLocationBtn?.addEventListener('click', () => {
    handlers.onGetLocation?.();
  });

  elements.findHospitalsBtn?.addEventListener('click', () => {
    handlers.onFindHospitals?.();
  });

  elements.clearRouteBtn?.addEventListener('click', () => {
    handlers.onClearRoute?.();
  });

  elements.calculateEscapeBtn?.addEventListener('click', () => {
    handlers.onCalculateEscape?.(getRouteOptions());
  });

  elements.refreshRoutesBtn?.addEventListener('click', () => {
    handlers.onRefreshRoutes?.(getRouteOptions());
  });

  // Store handler for route selection
  routeSelectHandler = handlers.onRouteSelect;
}

export function getFilterValues() {
  return {
    timeRange: elements.timeFilter?.value || 'week',
    minMagnitude: parseFloat(elements.magnitudeFilter?.value) || 4.5
  };
}

export function getRouteOptions() {
  return {
    travelMode: elements.travelMode?.value || 'car'
  };
}

function toggleControlPanel() {
  elements.controlPanel?.classList.toggle('visible');
  elements.controlPanel?.classList.toggle('hidden');
}

export function updateStatus(message, type = 'success') {
  if (elements.statusIndicator) {
    elements.statusIndicator.textContent = message;
    elements.statusIndicator.className = `status-indicator status-${type}`;
  }
}

export function updateEarthquakeCount(count) {
  if (elements.earthquakeCount) {
    elements.earthquakeCount.textContent = `Found ${count} earthquake${count !== 1 ? 's' : ''}`;
  }
}

export function displayEarthquakeInfo(earthquake) {
  if (!earthquake) {
    hideEarthquakeInfo();
    return;
  }

  const dangerRadius = calculateDangerRadius(earthquake.magnitude);

  elements.eqLocation.textContent = earthquake.location;
  elements.eqMagnitude.textContent = `M ${earthquake.magnitude.toFixed(1)}`;
  elements.eqDepth.textContent = `${earthquake.depth.toFixed(1)} km`;
  elements.eqTime.textContent = formatEarthquakeTime(earthquake.time);
  elements.eqDangerRadius.textContent = `~${dangerRadius.toFixed(1)} km`;

  elements.earthquakeInfo.style.display = 'block';
}

export function hideEarthquakeInfo() {
  if (elements.earthquakeInfo) {
    elements.earthquakeInfo.style.display = 'none';
  }
}

export function displayLocationInfo(coords, isInDanger, earthquake) {
  if (!coords) {
    hideLocationInfo();
    return;
  }

  elements.locCoords.textContent = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  
  if (isInDanger) {
    elements.locStatus.textContent = 'IN DANGER ZONE';
    elements.locStatus.className = 'status-danger';
  } else if (earthquake) {
    elements.locStatus.textContent = 'Outside danger zone';
    elements.locStatus.className = 'status-safe';
  } else {
    elements.locStatus.textContent = 'Select earthquake to check';
    elements.locStatus.className = '';
  }

  if (earthquake) {
    const distance = calculateDistanceSimple(
      coords.lat, coords.lng,
      earthquake.coordinates.lat, earthquake.coordinates.lng
    );
    elements.locDistance.textContent = `${distance.toFixed(1)} km from epicenter`;
  } else {
    elements.locDistance.textContent = '-';
  }

  elements.locationInfo.style.display = 'block';
}

export function hideLocationInfo() {
  if (elements.locationInfo) {
    elements.locationInfo.style.display = 'none';
  }
}

function calculateDistanceSimple(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function displayHospitalsInfo(hospitals) {
  if (!hospitals || hospitals.length === 0) {
    hideHospitalsInfo();
    return;
  }

  elements.hospitalsCount.textContent = `${hospitals.length} hospitals found`;
  
  const listHtml = hospitals.slice(0, 10).map(h => `
    <div class="hospital-item" onclick="window.selectHospital('${h.id}')">
      <span class="hospital-icon">🏥</span>
      <div class="hospital-details">
        <strong>${h.name}</strong>
        <small>${h.distance.toFixed(1)} km from selected location</small>
      </div>
    </div>
  `).join('');

  elements.hospitalsList.innerHTML = listHtml;
  elements.hospitalsInfo.style.display = 'block';
}

export function hideHospitalsInfo() {
  if (elements.hospitalsInfo) {
    elements.hospitalsInfo.style.display = 'none';
  }
}

export function displaySelectedHospital(hospital) {
  if (elements.selectedHospitalName) {
    elements.selectedHospitalName.innerHTML = `🏥 ${hospital.name}`;
  }
}

export function displayRouteInfo(routeData, destination = null) {
  if (!routeData) {
    hideRouteInfo();
    return;
  }

  elements.routeDistance.textContent = formatDistance(routeData.distance);
  elements.routeDuration.textContent = formatDuration(routeData.duration);
  
  if (destination) {
    elements.routeDestination.textContent = destination.name;
  }
  
  let statusText = 'Road Route';
  let statusClass = 'status-safe';
  
  if (routeData.isRoadRoute) {
    statusText = 'Actual Road Route';
    statusClass = 'status-safe';
  } else if (routeData.isFallback) {
    statusText = 'Estimated (Offline)';
    statusClass = 'status-warning';
  }
  
  if (routeData.duration > 3600) {
    statusText += ' - Long';
  }

  if (elements.routeStatus) {
    elements.routeStatus.textContent = statusText;
    elements.routeStatus.className = statusClass;
  }

  elements.routeInfo.style.display = 'block';
}

export function hideRouteInfo() {
  if (elements.routeInfo) {
    elements.routeInfo.style.display = 'none';
  }
}

export function setLoading(isLoading, message = 'Loading...') {
  if (isLoading) {
    updateStatus(message, 'loading');
    disableButtons(true);
  } else {
    updateStatus('Ready', 'success');
    disableButtons(false);
  }
}

function disableButtons(disabled) {
  elements.fetchEarthquakesBtn?.toggleAttribute('disabled', disabled);
  elements.getLocationBtn?.toggleAttribute('disabled', disabled);
  elements.calculateEscapeBtn?.toggleAttribute('disabled', disabled);
  elements.findHospitalsBtn?.toggleAttribute('disabled', disabled);
}

export function showError(message) {
  updateStatus(message, 'error');
  console.error(message);
}

export function showSuccess(message) {
  updateStatus(message, 'success');
}

// ==========================================
// MULTI-ROUTE COMPARISON UI FUNCTIONS
// ==========================================

/**
 * Display multiple routes for comparison
 * @param {Array} routes - Array of route objects with metrics
 * @param {Object} recommendation - Route recommendation object
 * @param {Function} onSelect - Callback when route is selected
 */
export function displayRoutesComparison(routes, recommendation = null, onSelect = null) {
  if (!routes || routes.length === 0) {
    hideRoutesComparison();
    return;
  }

  // Update summary stats
  const fastest = routes[0];
  const shortest = [...routes].sort((a, b) => a.metrics.distance - b.metrics.distance)[0];
  
  elements.summaryRoutes.textContent = routes.length;
  elements.summaryFastest.textContent = fastest.formatted.adjustedDuration;
  elements.summaryShortest.textContent = shortest.formatted.distance;

  // Generate route cards
  const routesHtml = routes.map((route, index) => createRouteCard(route, index, recommendation)).join('');
  elements.routesList.innerHTML = routesHtml;

  // Generate legend
  const legendHtml = routes.map((route, index) => `
    <div class="route-legend-item">
      <span class="route-legend-color" style="background: ${route.color.primary};"></span>
      <span>Route ${String.fromCharCode(65 + index)}</span>
    </div>
  `).join('');
  elements.routesLegend.innerHTML = legendHtml;

  // Add click handlers to route cards
  routes.forEach((route, index) => {
    const card = document.getElementById(`route-card-${index}`);
    card?.addEventListener('click', () => {
      selectRouteInUI(index);
      if (onSelect) onSelect(route, index);
      if (routeSelectHandler) routeSelectHandler(route, index);
    });
  });

  // Expose global function for popup buttons
  window.selectRouteFromUI = (index) => {
    selectRouteInUI(index);
    if (onSelect) onSelect(routes[index], index);
    if (routeSelectHandler) routeSelectHandler(routes[index], index);
  };

  elements.routesComparisonSection.style.display = 'block';
}

/**
 * Create HTML for a single route card
 */
function createRouteCard(route, index, recommendation) {
  const letter = String.fromCharCode(65 + index);
  const isRecommended = recommendation?.recommended?.id === route.id;
  const congestion = route.metrics.congestion;
  const trafficSourceLabel = congestion.isRealTime ? 'Live' : 'Estimated';
  
  // Determine metric highlight classes
  const durationClass = route.isFastest ? 'highlight' : 
                        route.metrics.adjustedDuration > 3600 ? 'warning' : '';
  const congestionClass = congestion.score < 30 ? 'highlight' :
                          congestion.score > 60 ? 'danger' : 'warning';

  return `
    <div class="route-option ${isRecommended ? 'recommended' : ''}" 
         id="route-card-${index}"
         style="--route-color: ${route.color.primary};">
      
      <div class="route-option-header">
        <div class="route-label">
          <span class="route-letter">${letter}</span>
          <div>
            <div class="route-name">${route.destination.name}</div>
            <div class="route-destination-type">${route.destination.type || route.destination.subtype || 'Safe Zone'}</div>
          </div>
        </div>
      </div>

      <div class="route-metrics">
        <div class="metric">
          <span class="metric-label">Distance</span>
          <span class="metric-value">${route.formatted.distance}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Base Time</span>
          <span class="metric-value">${route.formatted.baseDuration}</span>
        </div>
        <div class="metric">
          <span class="metric-label">With Traffic</span>
          <span class="metric-value ${durationClass}">${route.formatted.adjustedDuration}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Safety</span>
          <span class="metric-value ${route.metrics.safetyScore > 70 ? 'highlight' : ''}">${route.metrics.safetyScore}/100</span>
        </div>
      </div>

      <div class="congestion-indicator">
        <span class="congestion-label" style="color: ${congestion.color};">
          ${congestion.icon} ${congestion.label} (${trafficSourceLabel})
        </span>
        <div class="congestion-bar">
          <div class="congestion-fill" style="width: ${congestion.score}%; background: ${congestion.color};"></div>
        </div>
      </div>

      <button class="route-select-btn" onclick="event.stopPropagation(); window.selectRouteFromUI(${index})">
        ${route.isFastest ? '⭐ Select Fastest Route' : 'Select This Route'}
      </button>
    </div>
  `;
}

/**
 * Select a route in the UI (highlight card)
 */
export function selectRouteInUI(index) {
  // Remove selection from all cards
  document.querySelectorAll('.route-option').forEach(card => {
    card.classList.remove('selected');
  });

  // Add selection to clicked card
  const selectedCard = document.getElementById(`route-card-${index}`);
  selectedCard?.classList.add('selected');

  // Scroll card into view
  selectedCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hide routes comparison section
 */
export function hideRoutesComparison() {
  if (elements.routesComparisonSection) {
    elements.routesComparisonSection.style.display = 'none';
  }
  elements.routesList.innerHTML = '';
}

/**
 * Display selected route details
 */
export function displaySelectedRouteInfo(route) {
  if (!route) {
    hideRouteInfo();
    return;
  }

  elements.routeDistance.textContent = route.formatted.distance;
  elements.routeDuration.textContent = route.formatted.baseDuration;
  elements.routeDestination.textContent = route.destination.name;
  
  // Extended route info
  if (elements.routeAdjustedDuration) {
    elements.routeAdjustedDuration.textContent = route.formatted.adjustedDuration;
  }
  
  if (elements.routeCongestion) {
    const sourceLabel = route.metrics.congestion.isRealTime ? 'Live' : 'Estimated';
    elements.routeCongestion.textContent = `${route.metrics.congestion.icon} ${route.metrics.congestion.label} (${sourceLabel})`;
    elements.routeCongestion.style.color = route.metrics.congestion.color;
  }
  
  if (elements.routeSafety) {
    const score = route.metrics.safetyScore;
    elements.routeSafety.textContent = `${score}/100`;
    elements.routeSafety.className = score > 70 ? 'status-safe' : score > 40 ? 'status-warning' : 'status-danger';
  }

  // Route status
  let statusText = route.isRoadRoute ? 'Road Route' : 'Estimated';
  if (route.isFastest) statusText = '⭐ ' + statusText + ' (Fastest)';
  
  if (elements.routeStatus) {
    elements.routeStatus.textContent = statusText;
    elements.routeStatus.className = route.metrics.safetyScore > 60 ? 'status-safe' : 'status-warning';
  }

  elements.routeInfo.style.display = 'block';
}

/**
 * Show routes loading state
 */
export function showRoutesLoading() {
  elements.routesList.innerHTML = `
    <div class="routes-loading">
      <div class="routes-loading-spinner"></div>
      <div class="routes-loading-text">
        Calculating routes...<br>
        <small>Analyzing traffic & congestion</small>
      </div>
    </div>
  `;
  elements.routesComparisonSection.style.display = 'block';
}

/**
 * Show no routes found message
 */
export function showNoRoutes(message = 'No routes found') {
  elements.routesList.innerHTML = `
    <div class="no-routes">
      <div class="no-routes-icon">🚫</div>
      <div class="no-routes-text">${message}</div>
    </div>
  `;
  elements.routesComparisonSection.style.display = 'block';
}
