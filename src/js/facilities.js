/**
 * Facilities module - Fetch nearby hospitals
 * Uses OpenStreetMap Overpass API (free, no key required)
 */

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Cache for hospital data
const hospitalCache = {
  data: null,
  center: null,
  timestamp: null
};

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch nearby hospitals
 * @param {Object} center - Center coordinates {lat, lng}
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Promise<Array>} Array of hospitals
 */
export async function fetchNearbyHospitals(center, radiusKm = 100) {
  // Check cache
  if (
    hospitalCache.data &&
    hospitalCache.center &&
      (hospitalCache.center, center) &&
    (Date.now() - hospitalCache.timestamp) < CACHE_DURATION
  ) {
    console.log('Returning cached hospital data');
    return hospitalCache.data;
  }

  const radiusMeters = radiusKm * 1000;
  
  // Overpass QL query for hospitals only
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radiusMeters},${center.lat},${center.lng});
      way["amenity"="hospital"](around:${radiusMeters},${center.lat},${center.lng});
      relation["amenity"="hospital"](around:${radiusMeters},${center.lat},${center.lng});
    );
    out center;
  `;

  try {
    console.log('Fetching nearby hospitals from Overpass API...');
    
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    const hospitals = parseHospitalData(data, center);

    // Update cache
    hospitalCache.data = hospitals;
    hospitalCache.center = { ...center };
    hospitalCache.timestamp = Date.now();

    return hospitals;
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    return [];
  }
}

/**
 * Parse Overpass API response for hospitals
 * @param {Object} data - Overpass API response
 * @param {Object} center - Center coordinates for distance calculation
 * @returns {Array} Parsed hospitals
 */
function parseHospitalData(data, center) {
  if (!data || !data.elements) {
    return [];
  }

  const hospitals = data.elements
    .map(element => {
      // Get coordinates (handle nodes, ways, relations)
      let lat, lng;
      if (element.type === 'node') {
        lat = element.lat;
        lng = element.lon;
      } else if (element.center) {
        lat = element.center.lat;
        lng = element.center.lon;
      } else {
        return null;
      }

      const tags = element.tags || {};
      const name = tags.name || tags['name:en'] || 'Hospital';

      return {
        id: `${element.type}-${element.id}`,
        name: name,
        coordinates: { lat, lng },
        distance: calculateDistance(center.lat, center.lng, lat, lng),
        address: tags['addr:full'] || tags['addr:street'] || '',
        phone: tags.phone || tags['contact:phone'] || ''
      };
    })
    .filter(h => h !== null)
    .sort((a, b) => a.distance - b.distance);

  return hospitals;
}

/**
 * Calculate distance between two points (Haversine)
 * @returns {number} Distance in kilometers
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
 * Check if two locations are approximately the same
 */
function isSameLocation(loc1, loc2, threshold = 0.01) {
  return Math.abs(loc1.lat - loc2.lat) < threshold &&
         Math.abs(loc1.lng - loc2.lng) < threshold;
}
