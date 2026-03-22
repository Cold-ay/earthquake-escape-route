/**
 * Multi-Route Service - Calculates multiple escape routes with real-time status
 * Compares routes by travel time, distance, and congestion
 */

import { calculateRoute, formatDistance, formatDuration } from './routing.js';
import { CONGESTION_LEVELS, estimateRouteCongestion } from './traffic.js';

// Route colors for map display
export const ROUTE_COLORS = [
  { primary: '#10b981', name: 'Fastest', label: 'Route A' },      // Emerald
  { primary: '#3b82f6', name: 'Alternative', label: 'Route B' },  // Blue
  { primary: '#8b5cf6', name: 'Alternative', label: 'Route C' },  // Purple
  { primary: '#f59e0b', name: 'Scenic', label: 'Route D' }        // Amber
];

/**
 * Calculate a single route with traffic/congestion metrics
 * Used when a specific hospital is selected
 * @param {Object} origin - User's location {lat, lng}
 * @param {Object} destination - Single destination (hospital)
 * @param {Object} earthquake - Selected earthquake data
 * @param {string} travelMode - Travel mode (car, foot, bike)
 * @returns {Promise<Object>} Route with metrics
 */
export async function calculateSingleRouteWithMetrics(origin, destination, earthquake, travelMode = 'car') {
  try {
    const routeData = await calculateRoute(origin, destination.coordinates, travelMode);
    
    const congestion = await estimateCongestion(routeData, earthquake, travelMode);
    
    // Calculate adjusted duration based on congestion
    const adjustedDuration = routeData.duration * congestion.factor;
        
    return {
      id: 'route-hospital',
      index: 0,
      destination: destination,
      originalRoute: routeData,
      coordinates: routeData.coordinates,
      color: ROUTE_COLORS[0],
      metrics: {
        distance: routeData.distance,
        baseDuration: routeData.duration,
        adjustedDuration: adjustedDuration,
        congestion: congestion,
        safetyScore: calculateSafetyScore(routeData, congestion, earthquake, destination)
      },
      formatted: {
        distance: formatDistance(routeData.distance),
        baseDuration: formatDuration(routeData.duration),
        adjustedDuration: formatDuration(adjustedDuration)
      },
      isRoadRoute: routeData.isRoadRoute,
      isFallback: routeData.isFallback,
      isFastest: true
    };
  } catch (error) {
    console.error(`Failed to calculate route to ${destination.name}:`, error);
    return null;
  }
}

/**
 * Calculate multiple escape routes with traffic/congestion data
 * @param {Object} origin - User's location {lat, lng}
 * @param {Object} earthquake - Selected earthquake data
 * @param {Array} destinations - Array of potential destinations (hospitals, safe zones)
 * @param {string} travelMode - Travel mode (car, foot, bike)
 * @returns {Promise<Array>} Array of route options with comparison metrics
 */
export async function calculateMultipleRoutes(origin, earthquake, destinations, travelMode = 'car') {
  // Calculate routes to each destination in parallel
  const routePromises = destinations.slice(0, 4).map(async (dest, index) => {
    try {
      const routeData = await calculateRoute(origin, dest.coordinates, travelMode);
      
      const congestion = await estimateCongestion(routeData, earthquake, travelMode);
      
      // Calculate adjusted duration based on congestion
      const adjustedDuration = routeData.duration * congestion.factor;
            
      return {
        id: `route-${index}`,
        index,
        destination: dest,
        originalRoute: routeData,
        coordinates: routeData.coordinates,
        color: ROUTE_COLORS[index] || ROUTE_COLORS[0],
        metrics: {
          distance: routeData.distance,
          baseDuration: routeData.duration,
          adjustedDuration: adjustedDuration,
          congestion: congestion,
          safetyScore: calculateSafetyScore(routeData, congestion, earthquake, dest)
        },
        formatted: {
          distance: formatDistance(routeData.distance),
          baseDuration: formatDuration(routeData.duration),
          adjustedDuration: formatDuration(adjustedDuration)
        },
        isRoadRoute: routeData.isRoadRoute,
        isFallback: routeData.isFallback
      };
    } catch (error) {
      console.error(`Failed to calculate route to ${dest.name}:`, error);
      return null;
    }
  });

  const results = await Promise.all(routePromises);
  
  // Filter out failed routes and sort by adjusted duration
  const validRoutes = results
    .filter(r => r !== null)
    .sort((a, b) => a.metrics.adjustedDuration - b.metrics.adjustedDuration);

  // Mark the fastest route
  if (validRoutes.length > 0) {
    validRoutes[0].isFastest = true;
    validRoutes[0].color.name = 'Fastest';
  }

  return validRoutes;
}

/**
 * Estimate congestion from live traffic first, then fall back to the
 * original heuristic model if live traffic is unavailable.
 */
async function estimateCongestion(routeData, earthquake, travelMode) {
  const liveCongestion = await estimateRouteCongestion(routeData.coordinates, travelMode);

  if (liveCongestion) {
    return liveCongestion;
  }

  return estimateFallbackCongestion(earthquake, travelMode);
}

function estimateFallbackCongestion(earthquake, travelMode) {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  // Base congestion from time of day
  let congestionScore = 0;
  
  // Rush hour detection (7-9 AM, 5-7 PM on weekdays)
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isMorningRush = hour >= 7 && hour <= 9;
  const isEveningRush = hour >= 17 && hour <= 19;
  
  if (isWeekday && (isMorningRush || isEveningRush)) {
    congestionScore += 40;
  } else if (hour >= 10 && hour <= 16) {
    congestionScore += 15;  // Midday
  } else if (hour >= 20 || hour <= 6) {
    congestionScore += 5;   // Night
  } else {
    congestionScore += 25;
  }
  
  // Earthquake evacuation surge factor
  // More people evacuating = more congestion on escape routes
  const timeSinceQuake = Date.now() - new Date(earthquake.time).getTime();
  const hoursSinceQuake = timeSinceQuake / (1000 * 60 * 60);
  
  if (hoursSinceQuake < 1) {
    congestionScore += 50;  // Immediate evacuation chaos
  } else if (hoursSinceQuake < 6) {
    congestionScore += 35;  // Heavy evacuation
  } else if (hoursSinceQuake < 24) {
    congestionScore += 20;  // Ongoing evacuation
  } else if (hoursSinceQuake < 72) {
    congestionScore += 10;  // Recovery phase
  }
  
  // Magnitude impact on evacuation traffic
  if (earthquake.magnitude >= 7) {
    congestionScore += 30;
  } else if (earthquake.magnitude >= 6) {
    congestionScore += 20;
  } else if (earthquake.magnitude >= 5) {
    congestionScore += 10;
  }
  
  // Travel mode adjustment
  if (travelMode === 'foot') {
    congestionScore *= 0.3;  // Walking less affected by traffic
  } else if (travelMode === 'bike') {
    congestionScore *= 0.5;  // Cycling moderately affected
  }
  
  // Add some variation to avoid identical fallback values when live traffic is unavailable.
  congestionScore += Math.random() * 15 - 7;
  
  // Clamp to valid range
  congestionScore = Math.max(0, Math.min(100, congestionScore));
  
  // Determine congestion level
  let level;
  if (congestionScore < 25) {
    level = CONGESTION_LEVELS.LOW;
  } else if (congestionScore < 50) {
    level = CONGESTION_LEVELS.MODERATE;
  } else if (congestionScore < 75) {
    level = CONGESTION_LEVELS.HIGH;
  } else {
    level = CONGESTION_LEVELS.SEVERE;
  }
  
  return {
    score: Math.round(congestionScore),
    ...level,
    isRealTime: false,
    provider: 'Fallback model',
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Calculate safety score for route (0-100)
 */
function calculateSafetyScore(routeData, congestion, earthquake, destination) {
  let score = 100;
  
  // Penalize for congestion (harder to evacuate)
  score -= congestion.score * 0.3;
  
  // Penalize for longer routes
  const durationMinutes = routeData.duration / 60;
  if (durationMinutes > 30) score -= 10;
  if (durationMinutes > 60) score -= 15;
  
  // Bonus for hospitals
  if (destination.type === 'hospital') {
    score += 10;
  }
  
  // Bonus for road routes (vs fallback)
  if (routeData.isRoadRoute) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate alternative safe destinations in different directions
 * @param {Object} earthquake - Earthquake data
 * @param {number} safeRadius - Safe radius in km
 * @returns {Array} Array of safe zone destinations
 */
export function generateAlternativeSafeZones(userLocation, earthquake, safeRadius) {
  const safeZones = [];
  
  // Calculate bearing from earthquake to user
  const userBearing = calculateBearing(
    earthquake.coordinates.lat, earthquake.coordinates.lng,
    userLocation.lat, userLocation.lng
  );
  
  // Generate 4 escape directions (away from epicenter)
  // Primary: directly away from epicenter
  // Alternatives: ±45° and ±90° from primary direction
  const bearingOffsets = [0, -45, 45, -90];
  const labels = ['Direct Escape', 'Northwest Route', 'Northeast Route', 'Perpendicular'];
  
  bearingOffsets.forEach((offset, index) => {
    const bearing = (userBearing + offset + 360) % 360;
    const destination = calculateDestinationPoint(
      earthquake.coordinates.lat,
      earthquake.coordinates.lng,
      bearing,
      safeRadius + (index * 5)  // Slightly vary distances
    );
    
    safeZones.push({
      id: `safe-zone-${index}`,
      name: `Safe Zone ${String.fromCharCode(65 + index)}`,
      type: 'safe-zone',
      subtype: labels[index],
      coordinates: destination,
      bearing: bearing,
      distance: safeRadius + (index * 5)
    });
  });
  
  return safeZones;
}

/**
 * Merge hospitals and safe zones into destination options
 */
export function mergeDestinations(hospitals, safeZones, maxCount = 4) {
  const destinations = [];
  
  // Prioritize nearest hospitals
  hospitals.slice(0, 2).forEach(h => {
    destinations.push({
      ...h,
      type: 'hospital',
      priority: 1
    });
  });
  
  // Add safe zones as alternatives
  safeZones.slice(0, maxCount - destinations.length).forEach(sz => {
    destinations.push({
      ...sz,
      priority: 2
    });
  });
  
  return destinations.slice(0, maxCount);
}

/**
 * Compare routes and generate recommendation
 */
export function generateRouteRecommendation(routes) {
  if (routes.length === 0) {
    return null;
  }
  
  const fastest = routes[0];
  const safest = [...routes].sort((a, b) => 
    b.metrics.safetyScore - a.metrics.safetyScore
  )[0];
  
  // Find route with lowest congestion
  const leastCongested = [...routes].sort((a, b) => 
    a.metrics.congestion.score - b.metrics.congestion.score
  )[0];
  
  let recommendation = fastest;
  let reason = 'Fastest route with acceptable conditions';
  
  // Prefer safest if significantly better
  if (safest.metrics.safetyScore > fastest.metrics.safetyScore + 15) {
    recommendation = safest;
    reason = 'Better safety conditions despite slightly longer time';
  }
  
  // Consider least congested if time difference is small
  if (leastCongested.id !== fastest.id) {
    const timeDiff = leastCongested.metrics.adjustedDuration - fastest.metrics.adjustedDuration;
    if (timeDiff < 300 && leastCongested.metrics.congestion.score < fastest.metrics.congestion.score - 20) {
      recommendation = leastCongested;
      reason = 'Less congested with minimal time difference';
    }
  }
  
  return {
    recommended: recommendation,
    reason,
    analysis: {
      fastest: fastest.id,
      safest: safest.id,
      leastCongested: leastCongested.id
    }
  };
}

// Helper functions
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function calculateDestinationPoint(lat, lng, bearing, distanceKm) {
  const R = 6371;
  const δ = distanceKm / R;
  const θ = toRad(bearing);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);

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

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function toDeg(rad) {
  return rad * (180 / Math.PI);
}
