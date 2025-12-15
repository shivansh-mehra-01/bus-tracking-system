// ================= COLLEGE LOCATION =================
const COLLEGE_COORDS = [23.3039, 77.3400]; // change to your college lat,lng

// ================= MAP SETUP =================
const map = L.map('map').setView([20.5937, 78.9629], 5);

// Tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ================= ICONS =================
const driverIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const studentIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// ================= COLLEGE MARKER =================
const collegeMarker = L.marker(COLLEGE_COORDS)
  .addTo(map)
  .bindPopup("College");

// ================= STUDENT LOCAL MARKER =================
let studentMarker = null;

if (typeof navigator !== 'undefined' && navigator.geolocation && document.getElementById('map')) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 13);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 1000 }
  );

  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

      if (!studentMarker) {
        studentMarker = L.marker([latitude, longitude], { icon: studentIcon })
          .addTo(map)
          .bindPopup("You (local)")
          .openPopup();
      } else {
        studentMarker.setLatLng([latitude, longitude]);
      }
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}

// ================= ROUTE HELPERS =================
let driverRouteLine = null;
let lastRoutePoint = null;
const MIN_ROUTE_DISTANCE = 50; // meters

// Haversine distance
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ================= DRIVER → COLLEGE ROUTE =================
window.drawDriverRoute = async function (driverLat, driverLng) {

  // update route only if moved >= 50m
  if (lastRoutePoint) {
    const moved = getDistanceMeters(
      lastRoutePoint.lat,
      lastRoutePoint.lng,
      driverLat,
      driverLng
    );

    if (moved < MIN_ROUTE_DISTANCE) return;
  }

  lastRoutePoint = { lat: driverLat, lng: driverLng };

  const url = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${COLLEGE_COORDS[1]},${COLLEGE_COORDS[0]}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) return;

    const data = await res.json();
    if (!data.routes || !data.routes[0]) return;

    const route = data.routes[0];

    // ================= ETA + DISTANCE =================
    const distanceKm = (route.distance / 1000).toFixed(2);
    const etaMin = Math.round(route.duration / 60);

    const infoDiv = document.getElementById("routeInfo");
    if (infoDiv) {
      infoDiv.innerText = `Distance: ${distanceKm} km | ETA: ${etaMin} min`;
    }

    // ================= DRAW ROUTE =================
    const routeCoords = route.geometry.coordinates.map(
      c => [c[1], c[0]]
    );

    if (driverRouteLine) {
      map.removeLayer(driverRouteLine);
    }

    driverRouteLine = L.polyline(routeCoords, {
      color: "blue",
      weight: 6
    }).addTo(map);

    map.fitBounds(driverRouteLine.getBounds(), { padding: [40, 40] });

  } catch (err) {
    console.warn("Route update skipped");
  }
};
