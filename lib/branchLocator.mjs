export function normalizeLocationQuery(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function radians(value) {
  return value * (Math.PI / 180);
}

export function distanceMiles(from, to) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const latitudeA = radians(from.latitude);
  const latitudeB = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function searchBranchLocations(locations, query, limit = 8) {
  const search = normalizeLocationQuery(query);
  if (!search) return [];
  const words = search.split(/\s+/);
  return locations
    .filter((location) => {
      const haystack = normalizeLocationQuery([
        location.name,
        location.systemName,
        location.street,
        location.city,
        location.state,
        location.postalCode,
      ].join(" "));
      return words.every((word) => haystack.includes(word));
    })
    .slice(0, limit);
}

export function nearestBranchLocations(locations, position, limit = 8) {
  return locations
    .map((location) => ({ location, distance: distanceMiles(position, location) }))
    .sort((first, second) => first.distance - second.distance)
    .slice(0, limit);
}
