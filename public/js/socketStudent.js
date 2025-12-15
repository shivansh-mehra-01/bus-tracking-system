const socket = io();

let followedDriverId = null;
let followedMarker = null;

// debug
socket.on("connect", () => {
  console.log("Student connected:", socket.id);
});

// ================= DRIVER LIST =================
socket.on("liveDrivers", (drivers) => {
  const list = document.getElementById("driversList");
  if (!list) return;

  list.innerHTML = "<strong>Live drivers:</strong>";

  if (!drivers || drivers.length === 0) {
    list.innerHTML += "<div>No drivers live</div>";
    return;
  }

  drivers.forEach(driver => {
    const row = document.createElement("div");
    row.className = "driver-row";

    row.innerHTML = `
      <span>${driver.name}</span>
      <button data-id="${driver.socketId}">
        ${followedDriverId === driver.socketId ? "Following" : "Follow"}
      </button>
    `;

    list.appendChild(row);
  });

  list.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => {
      followedDriverId = btn.dataset.id;

      // clear old state
      if (followedMarker) {
        map.removeLayer(followedMarker);
        followedMarker = null;
      }

      if (window.driverRouteLine) {
        map.removeLayer(window.driverRouteLine);
        window.driverRouteLine = null;
      }

      document.getElementById("arrivalStatus").innerText = "";
      document.getElementById("routeInfo").innerText = "Distance: -- km | ETA: -- min";

      // update UI
      list.querySelectorAll("button").forEach(b => b.innerText = "Follow");
      btn.innerText = "Following";

      alert("Following driver " + followedDriverId.slice(0,6));
    };
  });
});

// ================= DRIVER LOCATION =================
socket.on("updateLocation", ({ id, latitude, longitude }) => {
  // ❌ ignore if not following
  if (!followedDriverId || id !== followedDriverId) return;

  // ✅ show ONLY followed driver
  if (!followedMarker) {
    followedMarker = L.marker([latitude, longitude], { icon: driverIcon })
      .addTo(map)
      .bindPopup("Bus (Live)")
      .openPopup();
  } else {
    followedMarker.setLatLng([latitude, longitude]);
  }

  map.setView([latitude, longitude], 15);

  // 🔥 draw route + ETA + arrival
  window.drawDriverRoute(latitude, longitude);
});

// ================= DRIVER OFFLINE =================
socket.on("user-disconnected", ({ id }) => {
  if (id === followedDriverId) {
    followedDriverId = null;

    if (followedMarker) {
      map.removeLayer(followedMarker);
      followedMarker = null;
    }

    document.getElementById("routeInfo").innerText = "Driver went offline";
    document.getElementById("arrivalStatus").innerText = "";
  }
});
