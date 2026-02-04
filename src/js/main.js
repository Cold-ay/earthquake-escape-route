import { initializeMap, displayEarthquakes, displayDangerZone, setSelectedLocation, 
         getSelectedLocation, displayRoute, clearRoute, clearDangerZones, clearAll,
         displayHospitals, clearHospitals, clearSelectedLocation, centerMap,
         displayMultipleRoutes, selectRouteOnMap, clearAllRoutes } from './map.js';
import { fetchEarthquakes } from './earthquake.js';
import { calculateRoute } from './routing.js';
import { calculateMultipleRoutes, generateAlternativeSafeZones, 
         mergeDestinations, generateRouteRecommendation, calculateSingleRouteWithMetrics } from './multiRoute.js';
import { fetchNearbyHospitals } from './facilities.js';
import { calculateDangerRadius } from './config.js';
import { initializeUI, updateEarthquakeCount, displayEarthquakeInfo, 
         displayRouteInfo, setLoading, showError, showSuccess, hideRouteInfo,
         displayLocationInfo, hideLocationInfo, displayHospitalsInfo,
         hideHospitalsInfo, displaySelectedHospital, displayRoutesComparison,
         hideRoutesComparison, displaySelectedRouteInfo, selectRouteInUI,
         showRoutesLoading, showNoRoutes } from './ui.js';

// Application state
const state = {
  earthquakes: [],
  selectedEarthquake: null,
  selectedLocation: null,
  isLocationInDanger: false,
  hospitals: [],
  selectedHospital: null,
  currentRoute: null,

  // Multi-route state
  availableRoutes: [],
  selectedRouteIndex: -1
};

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing Earthquake Escape Route Navigator...');

  // Initialize map with click handler
  initializeMap('map', handleMapClick);

  // Initialize UI with event handlers
  initializeUI({
    onFetchEarthquakes: handleFetchEarthquakes,
    onGetLocation: handleGetCurrentLocation,
    onClearRoute: handleClearRoute,
    onCalculateEscape: handleCalculateEscapeRoutes,
    onFindHospitals: handleFindHospitals,
    onRefreshRoutes: handleRefreshRoutes,
    onRouteSelect: handleRouteSelect
  });

  // Expose global functions for popup buttons
  window.selectEarthquake = selectEarthquakeById;
  window.selectHospital = selectHospitalById;
  window.selectRouteById = selectRouteById;

  // Auto-fetch recent earthquakes on load
  await handleFetchEarthquakes({ timeRange: 'week', minMagnitude: 4.5 });

  console.log('Application initialized successfully');
  showSuccess('Click on map to select a location');
}

/**
 * Handle map click - select location
 */
function handleMapClick(coords) {
  state.selectedLocation = coords;
  
  // Check if location is in earthquake danger zone
  state.isLocationInDanger = checkIfInDangerZone(coords);
  
  // Update map marker
  setSelectedLocation(coords, state.isLocationInDanger);
  
  // Update UI
  displayLocationInfo(coords, state.isLocationInDanger, state.selectedEarthquake);
  
  // Clear hospitals and routes when location on map selected
  clearHospitals();
  clearAllRoutes();
  hideHospitalsInfo();
  hideRouteInfo();
  hideRoutesComparison();
  state.hospitals = [];
  state.selectedHospital = null;
  state.availableRoutes = [];
  state.selectedRouteIndex = -1;

  if (state.isLocationInDanger) {
    showSuccess('Location in danger zone! Find escape routes below.');
  } else {
    showSuccess('Location selected. Select an earthquake to check danger zone.');
  }
}

/**
 * Check if coordinates are within any earthquake danger zone
 */
function checkIfInDangerZone(coords) {
  if (!state.selectedEarthquake) return false;
  
  const eq = state.selectedEarthquake;
  const dangerRadius = calculateDangerRadius(eq.magnitude);
  const distance = calculateDistance(
    coords.lat, coords.lng,
    eq.coordinates.lat, eq.coordinates.lng
  );
  
  return distance <= dangerRadius;
}

/**
 * Calculate distance between two points (Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Handle fetch earthquakes button click
 */
async function handleFetchEarthquakes(filters) {
  setLoading(true, 'Fetching earthquakes...');

  try {
    state.earthquakes = await fetchEarthquakes(filters);
    displayEarthquakes(state.earthquakes, handleEarthquakeSelect);
    updateEarthquakeCount(state.earthquakes.length);
    showSuccess(`Loaded ${state.earthquakes.length} earthquakes`);
  } catch (error) {
    showError('Failed to fetch earthquake data');
    console.error(error);
  } finally {
    setLoading(false);
  }
}

/**
 * Handle earthquake selection
 */
function handleEarthquakeSelect(earthquake) {
  state.selectedEarthquake = earthquake;
  
  // Display danger zone
  displayDangerZone(earthquake);
  
  // Re-check if selected location is in danger
  if (state.selectedLocation) {
    state.isLocationInDanger = checkIfInDangerZone(state.selectedLocation);
    setSelectedLocation(state.selectedLocation, state.isLocationInDanger);
    displayLocationInfo(state.selectedLocation, state.isLocationInDanger, earthquake);
  }
  
  // Clear hospitals and routes when earthquake changes
  clearHospitals();
  clearAllRoutes();
  hideHospitalsInfo();
  hideRouteInfo();
  hideRoutesComparison();
  state.hospitals = [];
  state.selectedHospital = null;
  state.availableRoutes = [];
  state.selectedRouteIndex = -1;
  
  displayEarthquakeInfo(earthquake);
  showSuccess(`Selected: M${earthquake.magnitude.toFixed(1)} - ${earthquake.location}`);
}

/**
 * Select earthquake by ID (from popup)
 */
function selectEarthquakeById(id) {
  const earthquake = state.earthquakes.find(eq => eq.id === id);
  if (earthquake) {
    handleEarthquakeSelect(earthquake);
  }
}

/**
 * Handle get current GPS location
 */
async function handleGetCurrentLocation() {
  setLoading(true, 'Getting location...');

  try {
    const position = await getCurrentPosition();
    const coords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    handleMapClick(coords);
    centerMap(coords, 10);
    showSuccess('Current location set');
  } catch (error) {
    showError('Could not get location. Click on map instead.');
    console.error(error);
  } finally {
    setLoading(false);
  }
}

/**
 * Get current position using Geolocation API
 */
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

/**
 * Handle find nearby hospitals
 */
async function handleFindHospitals() {
  if (!state.selectedEarthquake) {
    showError('Please select an earthquake first');
    return;
  }

  setLoading(true, 'Finding nearby hospitals...');

  try {
    // Search hospitals within/close to earthquake area
    const searchRadius = Math.max(calculateDangerRadius(state.selectedEarthquake.magnitude) * 2, 100);
    
    state.hospitals = await fetchNearbyHospitals(
      state.selectedEarthquake.coordinates,
      searchRadius
    );

    if (state.hospitals.length === 0) {
      showError('No hospitals found in the area.');
      return;
    }

    // Display hospitals on map
    displayHospitals(state.hospitals, handleHospitalSelect);
    displayHospitalsInfo(state.hospitals);
    showSuccess(`Found ${state.hospitals.length} hospitals`);

  } catch (error) {
    showError('Failed to find hospitals');
    console.error(error);
  } finally {
    setLoading(false);
  }
}

/**
 * Handle hospital selection
 */
function handleHospitalSelect(hospital) {
  state.selectedHospital = hospital;
  displaySelectedHospital(hospital);
  showSuccess(`Selected: ${hospital.name}`);
}

/**
 * Select hospital by ID (from popup)
 */
function selectHospitalById(id) {
  const hospital = state.hospitals.find(h => h.id === id);
  if (hospital) {
    handleHospitalSelect(hospital);
    handleCalculateEscapeRoutes({ travelMode: 'car' });
  }
}

/**
 * Handle calculate escape routes
 * - If hospital selected: single route to that hospital
 * - If no hospital: multiple routes to safe zones for comparison
 */
async function handleCalculateEscapeRoutes(options) {
  if (!state.selectedLocation) {
    showError('Please select a location on the map first');
    return;
  }

  if (!state.selectedEarthquake) {
    showError('Please select an earthquake first');
    return;
  }

  if (!state.isLocationInDanger) {
    showError('Selected location is not in a danger zone');
    return;
  }

  const eq = state.selectedEarthquake;

  // CASE 1: Hospital is selected - show single route to that hospital
  if (state.selectedHospital) {
    await handleCalculateSingleRoute(options, state.selectedHospital, eq);
    return;
  }

  // CASE 2: No hospital selected - show multiple routes to safe zones
  await handleCalculateMultipleRoutes(options, eq);
}

/**
 * Calculate and display a single route to a selected hospital
 */
async function handleCalculateSingleRoute(options, hospital, earthquake) {
  setLoading(true, `Calculating route to ${hospital.name}...`);
  hideRoutesComparison();

  try {
    const destination = {
      ...hospital,
      type: 'hospital'
    };

    // Calculate single route with traffic metrics
    const route = await calculateSingleRouteWithMetrics(
      state.selectedLocation,
      destination,
      earthquake,
      options.travelMode
    );

    if (!route) {
      showError('Could not calculate route to hospital. Please try again.');
      setLoading(false);
      return;
    }

    // Store in state
    state.availableRoutes = [route];
    state.currentRoute = route;
    state.selectedRouteIndex = 0;

    // Display single route on map
    displayRoute(route.coordinates, route.metrics, {
      name: hospital.name,
      type: 'Hospital'
    });

    // Display route info with traffic metrics
    displaySelectedRouteInfo(route);

    showSuccess(`Route to ${hospital.name} calculated with live traffic data`);

  } catch (error) {
    showError('Failed to calculate route to hospital');
    console.error(error);
  } finally {
    setLoading(false);
  }
}

/**
 * Calculate and display multiple routes to safe zones for comparison
 */
async function handleCalculateMultipleRoutes(options, earthquake) {
  showRoutesLoading();
  setLoading(true, 'Calculating escape routes...');

  try {
    const dangerRadius = calculateDangerRadius(earthquake.magnitude);
    const safeRadius = dangerRadius * 1.5 + 10;

    // Generate alternative safe zones in different directions
    const safeZones = generateAlternativeSafeZones(
      state.selectedLocation,
      earthquake,
      safeRadius
    );

    if (safeZones.length === 0) {
      showNoRoutes('No safe zones could be generated.');
      setLoading(false);
      return;
    }

    // Calculate routes to all safe zone destinations
    const routes = await calculateMultipleRoutes(
      state.selectedLocation,
      earthquake,
      safeZones,
      options.travelMode
    );

    if (routes.length === 0) {
      showNoRoutes('Could not calculate any routes. Please try again.');
      setLoading(false);
      return;
    }

    // Store routes in state
    state.availableRoutes = routes;

    // Generate recommendation
    const recommendation = generateRouteRecommendation(routes);

    // Display routes on map
    displayMultipleRoutes(routes, handleRouteSelect);

    // Display route comparison UI
    displayRoutesComparison(routes, recommendation, handleRouteSelect);

    // Auto-select the recommended/fastest route
    if (routes.length > 0) {
      const recommendedIndex = recommendation?.recommended?.index || 0;
      handleRouteSelect(routes[recommendedIndex], recommendedIndex);
    }

    showSuccess(`Found ${routes.length} escape routes - select a hospital for direct routing`);

  } catch (error) {
    showError('Failed to calculate escape routes');
    console.error(error);
    showNoRoutes('Error calculating routes. Please try again.');
  } finally {
    setLoading(false);
  }
}

/**
 * Handle route selection from UI or map
 */
function handleRouteSelect(route, index) {
  state.selectedRouteIndex = index;
  state.currentRoute = route;

  // Highlight on map
  selectRouteOnMap(index);

  // Highlight in UI
  selectRouteInUI(index);

  // Display detailed route info
  displaySelectedRouteInfo(route);
}

/**
 * Select route by index (from map popup)
 */
function selectRouteById(index) {
  if (state.availableRoutes[index]) {
    handleRouteSelect(state.availableRoutes[index], index);
  }
}

/**
 * Handle refresh routes (recalculate with fresh traffic data)
 */
async function handleRefreshRoutes(options) {
  if (state.availableRoutes.length === 0) {
    showError('No routes to refresh. Calculate routes first.');
    return;
  }

  showSuccess('Refreshing traffic data...');
  await handleCalculateEscapeRoutes(options);
}

/**
 * Calculate bearing between two points
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function toDeg(rad) {
  return rad * (180 / Math.PI);
}

/**
 * Calculate destination point from start, bearing, and distance
 */
function calculateDestinationPoint(lat, lng, bearing, distanceKm) {
  const R = 6371; // Average radius of the Earth in km
  const δ = distanceKm / R; // Distance in radians
  const θ = toRad(bearing); // Bearing in radians
  const φ1 = toRad(lat); // Latitude in radians
  const λ1 = toRad(lng); // Longitude in radians

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
    Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return {
    lat: toDeg(φ2),
    lng: toDeg(λ2)
  };
}

/**
 * Handle clear route
 */
function handleClearRoute() {
  clearAllRoutes();
  clearHospitals();
  clearDangerZones();
  clearSelectedLocation();
  
  state.selectedEarthquake = null;
  state.selectedLocation = null;
  state.isLocationInDanger = false;
  state.hospitals = [];
  state.selectedHospital = null;
  state.currentRoute = null;
  state.availableRoutes = [];
  state.selectedRouteIndex = -1;
  
  displayEarthquakeInfo(null);
  hideLocationInfo();
  hideHospitalsInfo();
  hideRouteInfo();
  hideRoutesComparison();
  
  showSuccess('Cleared. Click on map to select a new location.');
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
