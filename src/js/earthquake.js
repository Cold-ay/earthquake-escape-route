import { CONFIG } from './config.js';

// Cache for earthquake data
const earthquakeCache = {
  data: null,
  timestamp: null,
  params: null
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch earthquake data from USGS API
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Array of earthquake features
 */
export async function fetchEarthquakes(options = {}) {
  const {
    timeRange = 'week',
    minMagnitude = 4.5,
    limit = 100
  } = options;

  // Calculate start time based on time range
  const now = new Date();
  const daysAgo = CONFIG.TIME_FILTERS[timeRange] || 7;
  const startTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  // Build query parameters
  const params = new URLSearchParams({
    format: 'geojson',
    starttime: startTime.toISOString().split('T')[0],
    minmagnitude: minMagnitude,
    orderby: 'time',
    limit: limit
  });

  // Check cache
  const cacheKey = params.toString();
  if (
    earthquakeCache.data &&
    earthquakeCache.params === cacheKey &&
    (Date.now() - earthquakeCache.timestamp) < CACHE_DURATION
  ) {
    console.log('Returning cached earthquake data');
    return earthquakeCache.data;
  }

  try {
    const url = `${CONFIG.USGS_API_URL}?${params}`;
    console.log('Fetching earthquakes from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data = await response.json();
    const earthquakes = parseEarthquakeData(data);

    // Update cache
    earthquakeCache.data = earthquakes;
    earthquakeCache.timestamp = Date.now();
    earthquakeCache.params = cacheKey;

    return earthquakes;
  } catch (error) {
    console.error('Error fetching earthquake data:', error);
    throw error;
  }
}

/**
 * Parse USGS GeoJSON response into usable format
 * @param {Object} data - USGS GeoJSON response
 * @returns {Array} Parsed earthquake data
 */
function parseEarthquakeData(data) {
  if (!data || !data.features) {
    return [];
  }

  return data.features.map(feature => {
    const { properties, geometry } = feature;
    const [lng, lat, depth] = geometry.coordinates;

    return {
      id: feature.id,
      location: properties.place || 'Unknown location',
      magnitude: properties.mag,
      depth,
      time: new Date(properties.time),
      coordinates: {
        lat,
        lng
      },
      url: properties.url,
      tsunami: properties.tsunami,
      felt: properties.felt,
      significance: properties.sig
    };
  });
}

/**
 * Calculate distance between two points (Haversine formula)
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
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
 * Format earthquake time for display
 * @param {Date} time - Earthquake time
 * @returns {string} Formatted time string
 */
export function formatEarthquakeTime(time) {
  const now = new Date();
  const diff = now - time;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else {
    return time.toLocaleDateString();
  }
}
