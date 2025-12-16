// ================= COLLEGE LOCATION =================
const COLLEGE_COORDS = [23.3039, 77.3400]; // college lat,lng
const ARRIVAL_DISTANCE = 100; // meters
const MIN_ROUTE_DISTANCE = 50; // meters

// ================= GLOBAL FLAGS =================
window.isDriverLive = window.isDriverLive || false;
const pageType = document.body.dataset.page;

// user interaction lock (IMPORTANT)
let userInteractedWithMap = false;

// ================= MAP SETUP =================
const map = L.map("map").setView([20.5937, 78.9629], 5);

// Detect user interaction → STOP AUTO ZOOM
map.on("zoomstart dragstart", () => {
  userInteractedWithMap = true;
});

// Tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// ================= ICONS =================
const driverIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const studentIcon = L.divIcon({
  className: "",
  html: `<div class="student-gps-dot"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// ================= COLLEGE MARKER =================
L.marker(COLLEGE_COORDS).addTo(map).bindPopup("College");

// ================= STUDENT / DRIVER-OFFLINE BLUE DOT =================
let studentDot = null;
let accuracyCircle = null;
let hasCenteredStudent = false;

if (navigator.geolocation && document.getElementById("map")) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const latlng = [latitude, longitude];

      // ❌ DRIVER LIVE → REMOVE BLUE DOT
      if (pageType === "driver" && window.isDriverLive === true) {
        if (studentDot) {
          map.removeLayer(studentDot);
          studentDot = null;
        }
        if (accuracyCircle) {
          map.removeLayer(accuracyCircle);
          accuracyCircle = null;
        }
        return;
      }

      // 🔵 BLUE DOT (student OR driver-offline)
      if (!studentDot) {
        studentDot = L.marker(latlng, { icon: studentIcon })
          .addTo(map)
          .bindPopup(
            pageType === "driver"
              ? "You (Driver – Offline)"
              : "You (Student)"
          );

        // auto center ONLY ONCE and ONLY if user didn’t touch map
        if (!hasCenteredStudent && !userInteractedWithMap) {
          map.setView(latlng, 15);
          hasCenteredStudent = true;
        }
      } else {
        studentDot.setLatLng(latlng);
      }

      // 🔵 Accuracy circle
      const safeAccuracy = Math.min(accuracy || 30, 80);
      if (!accuracyCircle) {
        accuracyCircle = L.circle(latlng, {
          radius: safeAccuracy,
          color: "#1e88e5",
          fillColor: "#1e88e5",
          fillOpacity: 0.15,
          weight: 1
        }).addTo(map);
      } else {
        accuracyCircle.setLatLng(latlng);
        accuracyCircle.setRadius(safeAccuracy);
      }
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );
}

// ================= ROUTE HELPERS =================
let driverRouteLine = null;
let lastRoutePoint = null;
let hasReachedCollege = false;
let hasFitRoute = false;

// Haversine distance
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;

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
  if (hasReachedCollege) return;

  // ===== ARRIVAL CHECK =====
  const distanceToCollege = getDistanceMeters(
    driverLat,
    driverLng,
    COLLEGE_COORDS[0],
    COLLEGE_COORDS[1]
  );

  if (distanceToCollege <= ARRIVAL_DISTANCE) {
    hasReachedCollege = true;

    const infoDiv = document.getElementById("routeInfo");
    const statusDiv = document.getElementById("arrivalStatus");

    if (infoDiv) infoDiv.innerText = "Distance: 0 km | ETA: 0 min";
    if (statusDiv) statusDiv.innerText = "🏁 Bus has reached the college";

    if (driverRouteLine) {
      map.removeLayer(driverRouteLine);
      driverRouteLine = null;
    }
    return;
  }

  // ===== UPDATE ONLY IF MOVED ≥ 50m =====
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

    // ===== ETA + DISTANCE =====
    const distanceKm = (route.distance / 1000).toFixed(2);
    const etaMin = Math.round(route.duration / 60);

    const infoDiv = document.getElementById("routeInfo");
    if (infoDiv) {
      infoDiv.innerText = `Distance: ${distanceKm} km | ETA: ${etaMin} min`;
    }

    // ===== DRAW ROUTE =====
    const routeCoords = route.geometry.coordinates.map(
      (c) => [c[1], c[0]]
    );

    if (driverRouteLine) map.removeLayer(driverRouteLine);

    driverRouteLine = L.polyline(routeCoords, {
      color: "blue",
      weight: 6
    }).addTo(map);

    // auto fit ONLY ONCE and ONLY if user didn’t interact
    if (!hasFitRoute && !userInteractedWithMap) {
      map.fitBounds(driverRouteLine.getBounds(), { padding: [40, 40] });
      hasFitRoute = true;
    }
  } catch (err) {
    console.warn("Route update skipped");
  }
};

// ================= DRIVER LIVE / OFFLINE EVENTS =================
document.addEventListener("driver-live", () => {
  window.isDriverLive = true;
});

document.addEventListener("driver-offline", () => {
  window.isDriverLive = false;
  hasFitRoute = false;
  hasReachedCollege = false;
  lastRoutePoint = null;
});
