// public/js/socketStudent.js
// UPDATED: student-side socket handling to show red driver markers and provide "follow" action
const socket = io();

const markers = {}; // driver markers keyed by driver socket id
let currentlyFollowing = null;

// debug
socket.on('connect', () => console.log('Student connected socket id:', socket.id));

// UPDATED: receive live drivers list (so UI can show names + follow buttons)
socket.on("liveDrivers", (list) => {
  const container = document.getElementById("driversList");
  if (!container) return;
  container.innerHTML = "<strong>Live drivers:</strong>";
  if (!list || list.length === 0) {
    container.innerHTML += "<div>No drivers live right now.</div>";
    return;
  }
  list.forEach(d => {
    const row = document.createElement("div");
    row.className = "driver-row";
    row.innerHTML = `<div>${d.name} (${d.socketId.slice(0,6)})</div>
                     <div><button data-sid="${d.socketId}">${ currentlyFollowing === d.socketId ? 'Following' : 'Follow' }</button></div>`;
    container.appendChild(row);
  });

  // attach click handlers
  container.querySelectorAll("button[data-sid]").forEach(btn => {
    btn.addEventListener("click", () => {
      const sid = btn.getAttribute("data-sid");
      currentlyFollowing = sid;
      // update buttons UI quickly
      container.querySelectorAll("button[data-sid]").forEach(b => b.innerText = (b.getAttribute("data-sid") === sid) ? 'Following' : 'Follow');
      alert("Now following driver: " + sid.slice(0,6));
    });
  });
});

// UPDATED: when server broadcasts driver location (always use RED driver icon)
socket.on("updateLocation", (driverData) => {
  const { id, latitude, longitude } = driverData;
  if (!id) return;

  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
  } else {
    markers[id] = L.marker([latitude, longitude], { icon: driverIcon })
      .addTo(map)
      .bindPopup(`Driver: ${id}`);
  }

  // If following, center map and open popup
  if (currentlyFollowing && id === currentlyFollowing) {
    map.setView([latitude, longitude], 15, { animate: true });
    markers[id].openPopup();
  }
});

// Remove marker on disconnect
socket.on("user-disconnected", ({ id }) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});

// (Optional) generic location handler left minimal
socket.on("recieve-location", (data) => {
  // You can handle other clients here. For clarity we focus on driver updates via updateLocation.
  // console.log('recieve-location: ', data);
});
