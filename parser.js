(function (root) {
  'use strict';

  function coordinates(value) {
    if (!value) return null;
    let latitude;
    let longitude;
    if (typeof value === 'string') {
      const match = value.match(/(?:geo:)?\s*(-?\d+(?:\.\d+)?)\s*°?\s*,\s*(-?\d+(?:\.\d+)?)\s*°?/i);
      if (match) {
        latitude = Number(match[1]);
        longitude = Number(match[2]);
      }
    } else if (Array.isArray(value)) {
      longitude = Number(value[0]);
      latitude = Number(value[1]);
    } else if (typeof value === 'object') {
      if (value.latLng) return coordinates(value.latLng);
      if (value.latitudeE7 != null && value.longitudeE7 != null) {
        latitude = Number(value.latitudeE7) / 1e7;
        longitude = Number(value.longitudeE7) / 1e7;
      } else if (value.latE7 != null && value.lngE7 != null) {
        latitude = Number(value.latE7) / 1e7;
        longitude = Number(value.lngE7) / 1e7;
      } else {
        latitude = Number(value.latitude ?? value.lat);
        longitude = Number(value.longitude ?? value.lng ?? value.lon);
      }
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return [latitude, longitude];
  }

  function timestamp(value) {
    if (value == null || value === '') return null;
    const date = new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function pathMiles(path) {
    if (path.length < 2) return null;
    let miles = 0;
    for (let index = 1; index < path.length; index += 1) {
      const previous = path[index - 1];
      const current = path[index];
      const radians = Math.PI / 180;
      const latitudeDelta = (current.latitude - previous.latitude) * radians;
      const longitudeDelta = (current.longitude - previous.longitude) * radians;
      const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(previous.latitude * radians) * Math.cos(current.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
      miles += 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
    }
    return miles;
  }

  function parse(data) {
    const points = [];
    function point(location, date) {
      const position = coordinates(location);
      return position ? { latitude: position[0], longitude: position[1], timestamp: timestamp(date) } : null;
    }
    function add(location, date, name, kind) {
      const result = point(location, date);
      if (result) points.push({ ...result, name: name || '', kind });
    }
    function addTrip(start, end, startTime, endTime, path, distanceMeters) {
      const startPoint = point(start, startTime) || path[0] || null;
      const endPoint = point(end, endTime) || (path.length > 1 ? path[path.length - 1] : null);
      const reportedDistance = distanceMeters == null || distanceMeters === '' ? NaN : Number(distanceMeters);
      const hasReportedDistance = Number.isFinite(reportedDistance) && reportedDistance >= 0;
      const estimatedDistance = path.length > 1 ? pathMiles([startPoint, ...path, endPoint].filter(Boolean)) : null;
      points.push({
        kind: 'Trip',
        name: '',
        timestamp: timestamp(startTime),
        endTimestamp: timestamp(endTime),
        start: startPoint,
        end: endPoint,
        startName: start?.name || start?.address || '',
        endName: end?.name || end?.address || '',
        path: path,
        distanceMiles: hasReportedDistance ? reportedDistance / 1609.344 : estimatedDistance,
        distanceSource: hasReportedDistance ? 'reported' : estimatedDistance == null ? null : 'path'
      });
    }
    function segments(items) {
      const activities = [];
      const standalonePath = [];
      items.forEach(function (item) {
        const start = item.startTime || item.startTimeMs;
        const end = item.endTime || item.endTimeMs;
        const visit = item.visit?.topCandidate;
        if (visit) add(visit.placeLocation, start, visit.placeName || visit.semanticType || '', 'Visit');
        const path = (Array.isArray(item.timelinePath) ? item.timelinePath : []).map(function (entry) {
          let date = entry.time ?? entry.timestamp ?? entry.timestampMs;
          const startMillis = Date.parse(timestamp(start));
          if (date == null && Number.isFinite(startMillis) && entry.minutesOffsetFromStartTime != null) date = startMillis + Number(entry.minutesOffsetFromStartTime) * 60000;
          return point(entry.point, date);
        }).filter(Boolean);
        if (item.activity) {
          activities.push({ item, start, end, path, acceptsMatchedPoints: path.every(function (entry) { return entry.timestamp; }), startMillis: Date.parse(timestamp(start)), endMillis: Date.parse(timestamp(end)) });
        } else {
          path.forEach(function (entry) { standalonePath.push(entry); });
        }
      });

      const windows = activities.filter(function (activity) {
        return Number.isFinite(activity.startMillis) && Number.isFinite(activity.endMillis) && activity.endMillis >= activity.startMillis;
      }).sort(function (left, right) { return left.startMillis - right.startMillis; });
      standalonePath.sort(function (left, right) { return (left.timestamp || '').localeCompare(right.timestamp || ''); });
      let nextWindow = 0;
      let active = [];
      standalonePath.forEach(function (entry) {
        const time = Date.parse(entry.timestamp);
        if (Number.isFinite(time)) {
          active = active.filter(function (activity) { return activity.endMillis >= time; });
          while (nextWindow < windows.length && windows[nextWindow].startMillis <= time) {
            if (windows[nextWindow].endMillis >= time) active.push(windows[nextWindow]);
            nextWindow += 1;
          }
        }
        if (Number.isFinite(time) && active.length === 1 && active[0].acceptsMatchedPoints) {
          active[0].path.push(entry);
        } else {
          points.push({ ...entry, name: '', kind: 'Path' });
        }
      });

      activities.forEach(function (activity) {
        if (activity.path.every(function (entry) { return entry.timestamp; })) {
          activity.path.sort(function (left, right) { return left.timestamp.localeCompare(right.timestamp); });
          const seen = new Set();
          activity.path = activity.path.filter(function (entry) {
            const key = JSON.stringify([entry.timestamp, entry.latitude, entry.longitude]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
        const item = activity.item;
        addTrip(item.activity.start, item.activity.end, activity.start, activity.end, activity.path, item.activity.distanceMeters ?? item.activity.distance);
      });
    }
    function legacy(item) {
      if (item.placeVisit) {
        const visit = item.placeVisit;
        add(visit.location, visit.duration?.startTimestamp || visit.duration?.startTimestampMs, visit.location?.name || visit.location?.address, 'Visit');
      }
      if (item.activitySegment) {
        const activity = item.activitySegment;
        const rawPath = (activity.simplifiedRawPath?.points || []).map(function (entry) { return point(entry, entry.timestamp || entry.timestampMs); }).filter(Boolean);
        const waypoints = (activity.waypointPath?.waypoints || []).map(function (entry) { return point(entry, entry.timestamp || entry.timestampMs); }).filter(Boolean);
        const path = rawPath.length > 1 || waypoints.length === 0 ? rawPath : waypoints;
        addTrip(activity.startLocation, activity.endLocation, activity.duration?.startTimestamp || activity.duration?.startTimestampMs, activity.duration?.endTimestamp || activity.duration?.endTimestampMs, path, activity.distanceMeters ?? activity.distance);
      }
    }
    function feature(item) {
      if (item.geometry?.type !== 'Point') return;
      const properties = item.properties || {};
      add(item.geometry.coordinates, properties.date || properties.timestamp || properties['Google Maps URL']?.published, properties.name || properties.Name || properties.title || '', 'Place');
    }
    if (Array.isArray(data)) segments(data);
    if (Array.isArray(data?.semanticSegments)) segments(data.semanticSegments);
    if (Array.isArray(data?.timelineObjects)) data.timelineObjects.forEach(legacy);
    if (Array.isArray(data?.locations)) data.locations.forEach(function (location) { add(location, location.timestamp || location.timestampMs, '', 'Location'); });
    if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) data.features.forEach(feature);
    if (data?.type === 'Feature') feature(data);
    points.sort(function (left, right) {
      if (!left.timestamp) return right.timestamp ? 1 : 0;
      if (!right.timestamp) return -1;
      return left.timestamp.localeCompare(right.timestamp);
    });
    return points;
  }

  root.MapsParser = { parse, coordinates };
})(typeof globalThis !== 'undefined' ? globalThis : this);