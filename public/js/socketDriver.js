// public/js/socketDriver.js
const socket = io();

let watchId = null;
let myMarker = null;
let hasCenteredDriver = false;

// GLOBAL DRIVER STATE
window.isDriverLive = false;

// buttons
const goLiveBtn = document.getElementById("goLiveBtn");
const goOfflineBtn = document.getElementById("goOfflineBtn");
const statusEl = document.getElementById("driverStatus");

// ================= UI HELPERS =================
function setLiveUI(isLive) {
  if (isLive) {
    goLiveBtn.disabled = true;
    goOfflineBtn.disabled = false;
    if (statusEl) statusEl.innerText = "Live";
  } else {
    goLiveBtn.disabled = false;
    goOfflineBtn.disabled = true;
    if (statusEl) statusEl.innerText = "Offline";
  }
}

// ================= SEND DRIVER LIVE =================
function sendDriverLive() {
  const info = window.DRIVER_INFO;

  if (!info || !info.busNumber || !info.routeName) {
    alert("Bus number or route missing");
    return false;
  }

  socket.emit("driverLive", {
    busNumber: info.busNumber,
    routeName: info.routeName,
    driverName: info.driverName
  });

  return true;
}

// ================= GO LIVE =================
goLiveBtn?.addEventListener("click", () => {
  if (window.isDriverLive) return;

  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  const ok = sendDriverLive();
  if (!ok) return;

  window.isDriverLive = true;
  document.dispatchEvent(new Event("driver-live"));
  setLiveUI(true);

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

      // emit location
      socket.emit("driverLocation", { latitude, longitude });

      // red marker
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

      // route update
      if (typeof drawDriverRoute === "function") {
        drawDriverRoute(latitude, longitude);
      }
    },
    (err) => {
      console.error("Driver geolocation error:", err);
      alert(err.message);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
});

// ================= STOP LIVE =================
goOfflineBtn?.addEventListener("click", () => {
  if (!window.isDriverLive) return;

  // stop GPS
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  socket.emit("driverOffline");

  window.isDriverLive = false;
  document.dispatchEvent(new Event("driver-offline"));
  setLiveUI(false);

  hasCenteredDriver = false;

  // remove marker
  if (myMarker) {
    map.removeLayer(myMarker);
    myMarker = null;
  }

  // remove route
  if (window.driverRouteLine) {
    map.removeLayer(window.driverRouteLine);
    window.driverRouteLine = null;
  }
});
