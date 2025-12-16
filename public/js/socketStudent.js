const socket = io();

const busSelect = document.getElementById("busSelect");
const trackBtn = document.getElementById("trackBusBtn");
const busStatus = document.getElementById("busStatus");

let selectedBusNumber = null;
let busMarker = null;

socket.on("connect", () => {
  console.log("Student socket connected");
});

socket.on("liveBuses", (list) => {
  console.log("Student received liveBuses:", list);

  busSelect.innerHTML = `<option value="">Select Bus</option>`;

  list.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.busNumber;
    opt.textContent = `Bus ${b.busNumber}`;
    busSelect.appendChild(opt);
  });

  busSelect.disabled = list.length === 0;
});

busSelect.addEventListener("change", () => {
  trackBtn.disabled = !busSelect.value;
});

trackBtn.addEventListener("click", () => {
  selectedBusNumber = busSelect.value;
  busStatus.innerText = `Tracking Bus ${selectedBusNumber}`;
});

socket.on("busLocation", ({ busNumber, latitude, longitude }) => {
  if (busNumber !== selectedBusNumber) return;

  if (!busMarker) {
    busMarker = L.marker([latitude, longitude], { icon: driverIcon })
      .addTo(map)
      .bindPopup(`Bus ${busNumber}`)
      .openPopup();

    map.setView([latitude, longitude], 15);
  } else {
    busMarker.setLatLng([latitude, longitude]);
  }

  drawDriverRoute(latitude, longitude);
});
