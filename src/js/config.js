// API Configuration
export const CONFIG = {
  // USGS Earthquake API (Free, no key required)
  USGS_API_URL: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
  
  // Map defaults
  DEFAULT_CENTER: [22.3027, 114.1772], // Hong Kong
  DEFAULT_ZOOM: 5,
  
  // Time filter options (in days)
  TIME_FILTERS: {
    day: 1,
    week: 7,
    month: 30
  },
  
  // Magnitude color scheme
  MAGNITUDE_COLORS: {
    low: '#22c55e',      // < 4.0
    moderate: '#eab308', // 4.0 - 5.9
    high: '#f97316',     // 6.0 - 6.9
    major: '#ef4444'     // 7.0+
  },
  
  // Safe zone settings
  SAFE_ZONE_COLOR: '#3b82f6',
  DANGER_ZONE_OPACITY: 0.2,
  SAFE_BUFFER_MULTIPLIER: 1.5,

  // Facility display settings
  MAX_HOSPITAL_RESULTS: 8,

  // Live traffic settings
  TOMTOM_TRAFFIC_BASE_URL: 'https://api.tomtom.com/traffic/services/4/flowSegmentData',
  TRAFFIC_SAMPLE_POINTS: 4,
  TRAFFIC_FLOW_ZOOM: 10,
  TRAFFIC_CACHE_MS: 60 * 1000
};

// Calculate danger radius based on magnitude (in km)
export function calculateDangerRadius(magnitude) {
  // Mark not sure if formula correct
  return Math.exp(0.666*magnitude + 1.6);
}

// Color based on magnitude
export function getMagnitudeColor(magnitude) {
  if (magnitude < 4.0) return CONFIG.MAGNITUDE_COLORS.low;
  if (magnitude < 6.0) return CONFIG.MAGNITUDE_COLORS.moderate;
  if (magnitude < 7.0) return CONFIG.MAGNITUDE_COLORS.high;
  return CONFIG.MAGNITUDE_COLORS.major;
}

// Get magnitude class for styling
export function getMagnitudeClass(magnitude) {
  if (magnitude < 4.0) return 'low';
  if (magnitude < 6.0) return 'moderate';
  if (magnitude < 7.0) return 'high';
  return 'major';
}
