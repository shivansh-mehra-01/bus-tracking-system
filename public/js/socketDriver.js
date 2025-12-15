// public/js/socketDriver.js
// UPDATED: driver-side geolocation + socket emit + show own RED marker on map
const socket = io();

let watchId = null;
let myMarker = null;

const goLiveBtn = document.getElementById("goLiveBtn");
const goOfflineBtn = document.getElementById("goOfflineBtn");

// Optional: send driver name when going live
function sendDriverLive() {
  const nameInput = document.getElementById("driverName");
  const name = nameInput ? (nameInput.value || `Driver-${socket.id.slice(0, 6)}`) : `Driver-${socket.id.slice(0, 6)}`;
  socket.emit("driverLive", { name });
}

// Start sending driver location to server
goLiveBtn?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }
  if (watchId !== null) return; // already live

  // notify server
  sendDriverLive();

  watchId = navigator.geolocation.watchPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    drawDriverRoute(latitude, longitude);

    // Emit standardized event
    socket.emit("driverLocation", { latitude, longitude });

    // Show/update local red marker for driver
    if (!myMarker) {
      myMarker = L.marker([latitude, longitude], { icon: driverIcon })
        .addTo(map)
        .bindPopup("You (Driver)").openPopup();
      map.setView([latitude, longitude], 15);
    } else {
      myMarker.setLatLng([latitude, longitude]);
    }

    drawDriverRoute(latitude, longitude);

  }, (err) => {
    console.error("Geolocation error (driver):", err);
    alert("Geolocation error: " + err.message);
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });

  goLiveBtn?.setAttribute("disabled", "true");
  goOfflineBtn?.removeAttribute("disabled");
});

// Stop sending driver location
goOfflineBtn?.addEventListener("click", () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    socket.emit("driverOffline");
  }
  // remove local marker (optional)
  if (myMarker) {
    map.removeLayer(myMarker);
    myMarker = null;
  }

  goOfflineBtn?.setAttribute("disabled", "true");
  goLiveBtn?.removeAttribute("disabled");
});
