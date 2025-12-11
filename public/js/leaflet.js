// public/js/leaflet.js
// UPDATED: central map setup + icons + student local marker
// This file must be loaded before socketStudent.js and before socketDriver.js (driver still uses the same driverIcon/local marker).

// Create map (centered neutral; pages will adjust view when they get location)
const map = L.map('map').setView([20.5937, 78.9629], 5);

// Tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Icons: Driver = RED, Student = BLUE
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

// UPDATED: optional: show student's own location as BLUE marker (student page only)
// This runs here so that student page automatically displays its own marker.
// Driver page will also run this code, but driver will also create its own local red marker in socketDriver.js.
// We check for element existence and navigator availability.
let studentMarker = null;
if (typeof navigator !== 'undefined' && navigator.geolocation && document.getElementById('map')) {
  // Only run the watchPosition if this is student page OR we allow showing own location on driver page too.
  // To avoid double listeners, we check for an attribute on body (not strictly necessary).
  // We'll run it on both pages safely — driver script also manages its own marker.
  navigator.geolocation.getCurrentPosition((pos) => {
    // center roughly on first known position — do not replace watchPosition (below)
    map.setView([pos.coords.latitude, pos.coords.longitude], 13);
  }, () => {}, { enableHighAccuracy: true, maximumAge: 1000 });

  // Start watching student's own position (blue marker). If you don't want this on the driver page,
  // you can remove or guard this block by checking a page-specific flag.
  navigator.geolocation.watchPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    if (!studentMarker) {
      studentMarker = L.marker([latitude, longitude], { icon: studentIcon })
        .addTo(map)
        .bindPopup("You (local)").openPopup();
      map.setView([latitude, longitude], 13);
    } else {
      studentMarker.setLatLng([latitude, longitude]);
    }
  }, (err) => {
    // console.warn('student geolocation (leaflet.js) error', err);
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
}
