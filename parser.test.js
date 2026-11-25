require('./parser.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const timeline = MapsParser.parse({ semanticSegments: [{ startTime: '2024-01-01T10:00:00Z', visit: { topCandidate: { placeLocation: { latLng: 'geo:37.5,-122.5' }, placeName: 'Coffee' } }, timelinePath: [{ point: '37.6°, -122.6°', minutesOffsetFromStartTime: 5 }] }] });
assert(timeline.length === 2 && timeline[0].name === 'Coffee' && timeline[1].timestamp === '2024-01-01T10:05:00.000Z', 'Timeline segments');
const legacy = MapsParser.parse({ timelineObjects: [{ placeVisit: { location: { latitudeE7: 515000000, longitudeE7: -1200000, name: 'London' }, duration: { startTimestampMs: '1704067200000' } } }] });
assert(legacy.length === 1 && legacy[0].latitude === 51.5 && legacy[0].longitude === -0.12, 'Legacy timeline');
const records = MapsParser.parse({ locations: [{ latitudeE7: 400000000, longitudeE7: -700000000, timestamp: '2024-01-01T00:00:00Z' }, { latitudeE7: 9999999999, longitudeE7: 0 }] });
assert(records.length === 1 && records[0].kind === 'Location', 'Location records and invalid coordinates');
const places = MapsParser.parse({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-73.9, 40.7] }, properties: { name: 'Saved' } }] });
assert(places.length === 1 && places[0].latitude === 40.7 && places[0].name === 'Saved', 'Saved places');
assert(MapsParser.parse({ unrelated: true }).length === 0, 'Unknown formats');
const sorted = MapsParser.parse({ locations: [
  { latitudeE7: 10000000, longitudeE7: 10000000 },
  { latitudeE7: 20000000, longitudeE7: 20000000, timestamp: '2024-02-01T00:00:00Z' },
  { latitudeE7: 30000000, longitudeE7: 30000000, timestamp: '2024-01-01T00:00:00Z' }
] });
assert(sorted.map(function (point) { return point.latitude; }).join(',') === '3,2,1', 'Chronological order with undated locations last');
const trips = MapsParser.parse({ semanticSegments: [{
  startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:30:00Z',
  activity: { start: 'geo:40,-70', end: 'geo:41,-71' },
  timelinePath: [{ point: 'geo:40.5,-70.5', minutesOffsetFromStartTime: 15 }]
}] });
assert(trips.length === 1 && trips[0].kind === 'Trip' && trips[0].start.latitude === 40 && trips[0].end.latitude === 41 && trips[0].path[0].timestamp === '2024-01-01T10:15:00.000Z' && trips[0].endTimestamp === '2024-01-01T10:30:00.000Z', 'Timeline trip groups endpoints, times, and path');
const legacyTrip = MapsParser.parse({ timelineObjects: [{ activitySegment: {
  startLocation: { latitudeE7: 10000000, longitudeE7: 20000000 },
  endLocation: { latitudeE7: 30000000, longitudeE7: 40000000 },
  duration: { startTimestampMs: '1704067200000', endTimestampMs: '1704070800000' },
  waypointPath: { waypoints: [{ latitudeE7: 20000000, longitudeE7: 30000000 }] }
} }] });
assert(legacyTrip.length === 1 && legacyTrip[0].kind === 'Trip' && legacyTrip[0].start.latitude === 1 && legacyTrip[0].end.latitude === 3 && legacyTrip[0].path.length === 1 && legacyTrip[0].endTimestamp === '2024-01-01T01:00:00.000Z', 'Legacy trip groups waypoints and times');
const rawPathTrip = MapsParser.parse({ timelineObjects: [{ activitySegment: {
  startLocation: { latitudeE7: 10000000, longitudeE7: 20000000 },
  endLocation: { latitudeE7: 30000000, longitudeE7: 40000000 },
  simplifiedRawPath: { points: [{ latE7: 12000000, lngE7: 22000000, timestampMs: '1704067200000' }, { latE7: 28000000, lngE7: 38000000 }] },
  waypointPath: { waypoints: [{ latE7: 15000000, lngE7: 25000000 }] }
} }] });
assert(rawPathTrip[0].path.length === 2 && rawPathTrip[0].path[0].latitude === 1.2 && rawPathTrip[0].path[0].longitude === 2.2 && rawPathTrip[0].path[0].timestamp === '2024-01-01T00:00:00.000Z', 'Legacy raw path coordinates and timestamps');
const waypointTrip = MapsParser.parse({ timelineObjects: [{ activitySegment: {
  waypointPath: { waypoints: [{ latE7: 10000000, lngE7: 20000000 }, { latE7: 30000000, lngE7: 40000000 }] }
} }] });
assert(waypointTrip[0].path.length === 2 && waypointTrip[0].path[1].longitude === 4, 'Legacy E7 waypoint coordinates');
const pathOnly = MapsParser.parse({ semanticSegments: [{ timelinePath: [{ point: 'geo:1,2' }, { point: 'geo:3,4' }] }] });
assert(pathOnly.length === 2 && pathOnly.every(function (entry) { return entry.kind === 'Path'; }), 'Path-only segments are not trips');
const matched = MapsParser.parse({ semanticSegments: [
  { startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T12:00:00Z', timelinePath: [
    { point: 'geo:1,1', time: '2024-01-01T10:20:00Z' },
    { point: 'geo:2,2', time: '2024-01-01T10:10:00Z' },
    { point: 'geo:3,3', time: '2024-01-01T11:00:00Z' }
  ] },
  { startTime: '2024-01-01T10:05:00Z', endTime: '2024-01-01T10:30:00Z', activity: { start: 'geo:0,0', end: 'geo:4,4' } }
] });
const matchedTrip = matched.find(function (entry) { return entry.kind === 'Trip'; });
assert(matchedTrip.path.length === 2 && matchedTrip.path[0].latitude === 2 && matchedTrip.path[1].latitude === 1 && matchedTrip.distanceSource === 'path', 'Timestamped path points match and sort within an activity');
assert(matched.filter(function (entry) { return entry.kind === 'Trip'; }).length === 1 && matched.some(function (entry) { return entry.kind === 'Path' && entry.latitude === 3; }), 'Unmatched path points are not trips');
const ambiguous = MapsParser.parse({ semanticSegments: [
  { startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:30:00Z', activity: {} },
  { startTime: '2024-01-01T10:10:00Z', endTime: '2024-01-01T10:40:00Z', activity: {} },
  { timelinePath: [{ point: 'geo:1,1', time: '2024-01-01T10:20:00Z' }] }
] });
assert(ambiguous.filter(function (entry) { return entry.kind === 'Trip'; }).every(function (entry) { return entry.path.length === 0; }) && ambiguous.some(function (entry) { return entry.kind === 'Path'; }), 'Overlapping activities do not share ambiguous path points');
const duplicatePoints = MapsParser.parse({ semanticSegments: [
  { startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:30:00Z', activity: {}, timelinePath: [{ point: 'geo:1,1', time: '2024-01-01T10:15:00Z' }] },
  { timelinePath: [{ point: 'geo:1,1', time: '2024-01-01T10:15:00Z' }] }
] });
assert(duplicatePoints.filter(function (entry) { return entry.kind === 'Trip'; })[0].path.length === 1, 'Duplicate timestamped points are not counted twice');
const untimedPath = MapsParser.parse({ semanticSegments: [
  { startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:30:00Z', activity: {}, timelinePath: [{ point: 'geo:1,1' }] },
  { timelinePath: [{ point: 'geo:2,2', time: '2024-01-01T10:15:00Z' }] }
] });
assert(untimedPath.find(function (entry) { return entry.kind === 'Trip'; }).path.length === 1 && untimedPath.some(function (entry) { return entry.kind === 'Path'; }), 'Untimed embedded paths are not mixed with separately timed points');
const incompleteTrip = MapsParser.parse({ semanticSegments: [{ activity: { start: 'geo:1,2' } }] });
assert(incompleteTrip.length === 1 && incompleteTrip[0].start.latitude === 1 && incompleteTrip[0].end === null && incompleteTrip[0].endTimestamp === null, 'Incomplete trips preserve missing endpoints and times');
const reportedDistance = MapsParser.parse({ semanticSegments: [{ activity: { distanceMeters: 1609.344 } }] })[0];
assert(reportedDistance.distanceMiles === 1 && reportedDistance.distanceSource === 'reported', 'Reported distance is converted from meters to miles');
const legacyDistance = MapsParser.parse({ timelineObjects: [{ activitySegment: { distance: 3218.688 } }] })[0];
assert(legacyDistance.distanceMiles === 2 && legacyDistance.distanceSource === 'reported', 'Legacy reported distance');
const estimatedDistance = MapsParser.parse({ semanticSegments: [{ activity: {}, timelinePath: [{ point: 'geo:0,0' }, { point: 'geo:0,1' }] }] })[0];
assert(Math.abs(estimatedDistance.distanceMiles - 69.09) < 0.1 && estimatedDistance.distanceSource === 'path', 'Distance estimated from path points');
const noPathDistance = MapsParser.parse({ semanticSegments: [{ activity: { start: 'geo:0,0', end: 'geo:0,1' } }] })[0];
assert(noPathDistance.distanceMiles === null && noPathDistance.distanceSource === null, 'Endpoints alone do not imply miles traveled');
const zeroDistance = MapsParser.parse({ semanticSegments: [{ activity: { distanceMeters: 0 } }] })[0];
assert(zeroDistance.distanceMiles === 0 && zeroDistance.distanceSource === 'reported', 'Zero reported distance is preserved');
console.log('Parser tests passed');