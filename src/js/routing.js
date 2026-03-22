/**
 * Routing module - Uses OSRM (Open Source Routing Machine) for road-based routing
 * OSRM is free and doesn't require an API key
 * Enhanced with multi-route and traffic estimation support
 */

// OSRM public demo server (free, no API key required)
const OSRM_API_URL = 'https://router.project-osrm.org/route/v1';

export const TRAVEL_MODE_CONFIG = {
  car: {
    profile: 'driving',
    label: 'Driving',
    typicalSpeedKmh: 50,
    fallbackSpeedKmh: 40,
    fallbackRoadFactor: 1.4,
    trafficImpact: 1
  },
  foot: {
    profile: 'foot',
    label: 'Walking',
    typicalSpeedKmh: 5,
    fallbackSpeedKmh: 4,
    fallbackRoadFactor: 1.1,
    trafficImpact: 0.2
  },
  bike: {
    profile: 'cycling',
    label: 'Cycling',
    typicalSpeedKmh: 15,
    fallbackSpeedKmh: 12,
    fallbackRoadFactor: 1.2,
    trafficImpact: 0.45
  }
};

/**
 * Calculate route using OSRM API (actual road routing)
 * @param {Object} origin - Origin coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @param {string} travelMode - Travel mode (car, foot, bike)
 * @param {Object} options - Additional options {alternatives: boolean}
 * @returns {Promise<Object>} Route data with actual road distance and duration
 */
export async function calculateRoute(origin, destination, travelMode = 'car', options = {}) {
  const modeConfig = TRAVEL_MODE_CONFIG[travelMode] || TRAVEL_MODE_CONFIG.car;
  const profile = modeConfig.profile;
  const { alternatives = false } = options;
  
  // OSRM expects coordinates as lng,lat
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  
  // Request alternatives if specified
  const altParam = alternatives ? '&alternatives=true' : '';
  const url = `${OSRM_API_URL}/${profile}/${coordinates}?overview=full&geometries=geojson&steps=true&annotations=true${altParam}`;

  try {
    console.log('Calculating road route via OSRM...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM returned no routes, using fallback');
      return createFallbackRoute(origin, destination, travelMode);
    }

    const route = data.routes[0];
    const adjustedDuration = getModeAdjustedDuration(route.distance, route.duration, travelMode);
    
    // Parse road annotations for traffic estimation
    const roadAnnotations = parseRoadAnnotations(route.legs);
    
    return {
      distance: route.distance,           // meters (actual road distance)
      duration: adjustedDuration,         // seconds (mode-adjusted estimated time)
      coordinates: route.geometry.coordinates, // GeoJSON [lng, lat] array
      steps: parseRouteSteps(route.legs),
      annotations: roadAnnotations,
      travelMode,
      isRoadRoute: true,
      alternativeRoutes: alternatives ? data.routes.slice(1).map(alt => ({
        distance: alt.distance,
        duration: alt.duration,
        coordinates: alt.geometry.coordinates
      })) : []
    };

  } catch (error) {
    console.error('Error calculating route:', error);
    // Fallback to straight-line estimation
    return createFallbackRoute(origin, destination, travelMode);
  }
}

export function isRouteUsableForEscape(routeData) {
  if (
    !routeData ||
    !routeData.isRoadRoute ||
    routeData.isFallback ||
    !Array.isArray(routeData.coordinates) ||
    routeData.coordinates.length < 2
  ) {
    return false;
  }

  const steps = Array.isArray(routeData.steps) ? routeData.steps : [];

  if (steps.length === 0) {
    return false;
  }

  const hasForbiddenTransportStep = steps.some(step => {
    const mode = String(step.mode || '').toLowerCase();
    const name = String(step.name || '').toLowerCase();
    const instruction = String(step.instruction || '').toLowerCase();

    return (
      mode === 'ferry' ||
      mode === 'train' ||
      name.includes('ferry') ||
      name.includes('boat') ||
      instruction.includes('ferry')
    );
  });

  return !hasForbiddenTransportStep;
}

/**
 * Parse road annotations from OSRM for traffic/speed analysis
 */
function parseRoadAnnotations(legs) {
  const annotations = {
    avgSpeed: 0,
    roadTypes: [],
    totalSegments: 0
  };
  
  if (!legs) return annotations;
  
  let totalSpeed = 0;
  let speedCount = 0;
  
  legs.forEach(leg => {
    if (leg.annotation?.speed) {
      leg.annotation.speed.forEach(speed => {
        if (speed > 0) {
          totalSpeed += speed;
          speedCount++;
        }
      });
    }
  });
  
  annotations.avgSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;
  annotations.totalSegments = speedCount;
  
  return annotations;
}

/**
 * Parse route steps from OSRM response
 * @param {Array} legs - Route legs from OSRM
 * @returns {Array} Parsed steps with instructions
 */
function parseRouteSteps(legs) {
  if (!legs || legs.length === 0) return [];
  
  const steps = [];
  legs.forEach(leg => {
    if (leg.steps) {
      leg.steps.forEach(step => {
        if (step.maneuver) {
          steps.push({
            instruction: step.maneuver.type + (step.maneuver.modifier ? ` ${step.maneuver.modifier}` : ''),
            distance: step.distance,
            duration: step.duration,
            name: step.name || '',
            mode: step.mode || ''
          });
        }
      });
    }
  });
  return steps;
}

/**
 * Create fallback route when API is unavailable
 * Uses straight-line distance with estimated time
 */
function createFallbackRoute(origin, destination, travelMode) {
  const modeConfig = TRAVEL_MODE_CONFIG[travelMode] || TRAVEL_MODE_CONFIG.car;
  const distance = calculateHaversineDistance(
    origin.lat, origin.lng,
    destination.lat, destination.lng
  );

  // Estimate travel time based on mode-specific fallback assumptions.
  const estimatedRoadDistance = distance * modeConfig.fallbackRoadFactor;
  const speed = modeConfig.fallbackSpeedKmh;
  const duration = (estimatedRoadDistance / speed) * 3600;

  // Create interpolated coordinates for display
  const coordinates = interpolateCoordinates(origin, destination, 20);

  return {
    distance: estimatedRoadDistance * 1000, // meters
    duration,                               // seconds
    coordinates: coordinates,
    steps: [],
    travelMode,
    isRoadRoute: false,
    isFallback: true
  };
}

function getModeAdjustedDuration(distanceMeters, durationSeconds, travelMode) {
  const modeConfig = TRAVEL_MODE_CONFIG[travelMode] || TRAVEL_MODE_CONFIG.car;

  if (travelMode === 'car') {
    return durationSeconds;
  }

  const baselineDuration = (distanceMeters / 1000 / modeConfig.typicalSpeedKmh) * 3600;
  return Math.max(durationSeconds, baselineDuration);
}

/**
 * Calculate Haversine distance between two points
 * @returns {number} Distance in kilometers
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
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

/**
 * Interpolate coordinates between two points for fallback route display
 */
function interpolateCoordinates(start, end, numPoints) {
  const coords = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = start.lat + t * (end.lat - start.lat);
    const lng = start.lng + t * (end.lng - start.lng);
    coords.push([lng, lat]); // GeoJSON format [lng, lat]
  }
  
  return coords;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}
