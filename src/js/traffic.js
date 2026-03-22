import { CONFIG } from './config.js';

export const CONGESTION_LEVELS = {
  LOW: { label: 'Low Traffic', color: '#22c55e', factor: 1.0, icon: '🟢' },
  MODERATE: { label: 'Moderate', color: '#eab308', factor: 1.3, icon: '🟡' },
  HIGH: { label: 'Heavy Traffic', color: '#f97316', factor: 1.6, icon: '🟠' },
  SEVERE: { label: 'Severe Congestion', color: '#ef4444', factor: 2.2, icon: '🔴' }
};

const pointCache = new Map();

export function hasLiveTrafficApiKey() {
  return Boolean(import.meta.env.VITE_TOMTOM_API_KEY);
}

export async function estimateRouteCongestion(routeCoordinates, travelMode = 'car') {
  if (!hasLiveTrafficApiKey()) {
    return null;
  }

  const samplePoints = sampleRoutePoints(routeCoordinates, CONFIG.TRAFFIC_SAMPLE_POINTS);
  if (samplePoints.length === 0) {
    return null;
  }

  const responses = await Promise.allSettled(
    samplePoints.map(point => fetchFlowSegment(point))
  );

  const segments = responses
    .filter(result => result.status === 'fulfilled' && result.value)
    .map(result => result.value);

  if (segments.length === 0) {
    return null;
  }

  const aggregate = aggregateTrafficSegments(segments);
  const level = getCongestionLevel(aggregate.score);
  const factor = adjustFactorForMode(aggregate.delayRatio, travelMode);

  return {
    score: aggregate.score,
    ...level,
    factor,
    isRealTime: true,
    provider: 'TomTom',
    lastUpdated: new Date().toISOString(),
    samplesUsed: segments.length,
    samplesRequested: samplePoints.length,
    averageCurrentSpeed: aggregate.averageCurrentSpeed,
    averageFreeFlowSpeed: aggregate.averageFreeFlowSpeed,
    roadClosureDetected: aggregate.roadClosureDetected
  };
}

function sampleRoutePoints(routeCoordinates, maxPoints) {
  if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
    return [];
  }

  if (routeCoordinates.length <= maxPoints) {
    return routeCoordinates.map(([lng, lat]) => ({ lat, lng }));
  }

  const points = [];
  const lastIndex = routeCoordinates.length - 1;

  for (let i = 0; i < maxPoints; i++) {
    const ratio = maxPoints === 1 ? 0 : i / (maxPoints - 1);
    const index = Math.round(ratio * lastIndex);
    const [lng, lat] = routeCoordinates[index];
    points.push({ lat, lng });
  }

  return dedupeNearbyPoints(points);
}

function dedupeNearbyPoints(points) {
  const deduped = [];

  points.forEach(point => {
    const alreadyIncluded = deduped.some(existing =>
      Math.abs(existing.lat - point.lat) < 0.0001 &&
      Math.abs(existing.lng - point.lng) < 0.0001
    );

    if (!alreadyIncluded) {
      deduped.push(point);
    }
  });

  return deduped;
}

async function fetchFlowSegment(point) {
  const cacheKey = `${point.lat.toFixed(4)},${point.lng.toFixed(4)},${CONFIG.TRAFFIC_FLOW_ZOOM}`;
  const cached = pointCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CONFIG.TRAFFIC_CACHE_MS) {
    return cached.data;
  }

  const params = new URLSearchParams({
    key: import.meta.env.VITE_TOMTOM_API_KEY,
    point: `${point.lat},${point.lng}`,
    unit: 'kmph'
  });

  const url = `${CONFIG.TOMTOM_TRAFFIC_BASE_URL}/absolute/${CONFIG.TRAFFIC_FLOW_ZOOM}/json?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TomTom Traffic API error: ${response.status}`);
  }

  const json = await response.json();
  const flow = json?.flowSegmentData;

  if (!flow) {
    throw new Error('TomTom Traffic API returned no flow segment data');
  }

  const parsed = {
    currentSpeed: Number(flow.currentSpeed) || 0,
    freeFlowSpeed: Number(flow.freeFlowSpeed) || 0,
    currentTravelTime: Number(flow.currentTravelTime) || 0,
    freeFlowTravelTime: Number(flow.freeFlowTravelTime) || 0,
    confidence: Number(flow.confidence) || 0,
    roadClosure: Boolean(flow.roadClosure)
  };

  pointCache.set(cacheKey, {
    timestamp: Date.now(),
    data: parsed
  });

  return parsed;
}

function aggregateTrafficSegments(segments) {
  let weightedScore = 0;
  let weightedDelayRatio = 0;
  let weightedCurrentSpeed = 0;
  let weightedFreeFlowSpeed = 0;
  let totalWeight = 0;
  let roadClosureDetected = false;

  segments.forEach(segment => {
    const weight = Math.max(segment.confidence || 0, 0.25);
    const freeFlowSpeed = Math.max(segment.freeFlowSpeed, 1);
    const freeFlowTravelTime = Math.max(segment.freeFlowTravelTime, 1);
    const speedRatio = clamp(segment.currentSpeed / freeFlowSpeed, 0, 1);
    const delayRatio = clamp(segment.currentTravelTime / freeFlowTravelTime, 1, 3);
    const speedPenalty = (1 - speedRatio) * 100;
    const delayPenalty = (delayRatio - 1) * 100;
    let segmentScore = Math.max(speedPenalty, delayPenalty);

    if (segment.roadClosure) {
      roadClosureDetected = true;
      segmentScore = 100;
    }

    weightedScore += segmentScore * weight;
    weightedDelayRatio += delayRatio * weight;
    weightedCurrentSpeed += segment.currentSpeed * weight;
    weightedFreeFlowSpeed += segment.freeFlowSpeed * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) {
    return {
      score: 0,
      delayRatio: 1,
      averageCurrentSpeed: 0,
      averageFreeFlowSpeed: 0,
      roadClosureDetected
    };
  }

  return {
    score: Math.round(clamp(weightedScore / totalWeight, 0, 100)),
    delayRatio: clamp(weightedDelayRatio / totalWeight, 1, 3),
    averageCurrentSpeed: Math.round(weightedCurrentSpeed / totalWeight),
    averageFreeFlowSpeed: Math.round(weightedFreeFlowSpeed / totalWeight),
    roadClosureDetected
  };
}

function adjustFactorForMode(delayRatio, travelMode) {
  const normalizedDelay = Math.max(delayRatio - 1, 0);
  const modeImpact = {
    car: 1,
    bike: 0.45,
    foot: 0.2
  };

  const impact = modeImpact[travelMode] ?? 1;
  return Number((1 + normalizedDelay * impact).toFixed(2));
}

function getCongestionLevel(score) {
  if (score < 25) return CONGESTION_LEVELS.LOW;
  if (score < 50) return CONGESTION_LEVELS.MODERATE;
  if (score < 75) return CONGESTION_LEVELS.HIGH;
  return CONGESTION_LEVELS.SEVERE;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
