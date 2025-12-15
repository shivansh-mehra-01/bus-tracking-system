// public/js/socketDriver.js
const socket = io();

let watchId = null;
let myMarker = null;
let hasCenteredDriver = false;

// buttons
const goLiveBtn = document.getElementById("goLiveBtn");
const goOfflineBtn = document.getElementById("goOfflineBtn");

// ===== send driver live =====
function sendDriverLive() {
  const nameInput = document.getElementById("driverName");
  const name =
    nameInput?.value || `Driver-${socket.id.slice(0, 6)}`;

  socket.emit("driverLive", { name });
  window.isDriverLive = true;// shared flag (leaflet.js)
}

// ===== GO LIVE =====
goLiveBtn?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }
  if (watchId !== null) return;

  sendDriverLive();

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

      // emit to server
      socket.emit("driverLocation", { latitude, longitude });

      // red driver marker
      if (!myMarker) {
        myMarker = L.marker([latitude, longitude], { icon: driverIcon })
          .addTo(map)
          .bindPopup("You (Driver)")
          .openPopup();

        if (!hasCenteredDriver) {
          map.setView([latitude, longitude], 15);
          hasCenteredDriver = true;
        }
      } else {
        myMarker.setLatLng([latitude, longitude]);
      }

      // route to college (ONCE)
      drawDriverRoute(latitude, longitude);
    },
    (err) => {
      console.error("Driver geolocation error:", err);
      alert(err.message);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );

  goLiveBtn.disabled = true;
  goOfflineBtn.disabled = false;
});

// ===== GO OFFLINE =====
goOfflineBtn?.addEventListener("click", () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    socket.emit("driverOffline");
  }

  window.isDriverLive = false;

  hasCenteredDriver = false;

  // remove red marker
  if (myMarker) {
    map.removeLayer(myMarker);
    myMarker = null;
  }

  // route cleanup (important)
  if (window.driverRouteLine) {
    map.removeLayer(window.driverRouteLine);
    window.driverRouteLine = null;
  }

  goOfflineBtn.disabled = true;
  goLiveBtn.disabled = false;
});
