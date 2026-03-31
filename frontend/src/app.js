const API_BASE_URL = window.API_BASE_URL || "http://localhost:8080";

const venuesEl = document.getElementById("venues");
const slotsEl = document.getElementById("slots");
const resultEl = document.getElementById("result");
const selectedVenueText = document.getElementById("selectedVenueText");
const slotDateInput = document.getElementById("slotDate");

const refreshVenuesButton = document.getElementById("refreshVenues");
const bookingForm = document.getElementById("bookingForm");
const fetchBookingForm = document.getElementById("fetchBookingForm");
const cancelBookingForm = document.getElementById("cancelBookingForm");

const slotIdInput = document.getElementById("slotId");
const userIdInput = document.getElementById("userId");
const statusSelect = document.getElementById("status");
const bookingIdLookupInput = document.getElementById("bookingIdLookup");
const bookingIdCancelInput = document.getElementById("bookingIdCancel");
const cancelReasonInput = document.getElementById("cancelReason");

let selectedVenueId = null;

const now = new Date();
slotDateInput.value = now.toISOString().slice(0, 10);

refreshVenuesButton.addEventListener("click", () => {
  loadVenues();
});

slotDateInput.addEventListener("change", () => {
  if (selectedVenueId) {
    loadSlots(selectedVenueId, slotDateInput.value);
  }
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    userId: userIdInput.value.trim(),
    slotId: slotIdInput.value.trim(),
    status: statusSelect.value
  };

  try {
    const response = await requestJson(`${API_BASE_URL}/api/bookings`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showResult(response);
    if (response && response.data && response.data.id) {
      bookingIdLookupInput.value = response.data.id;
      bookingIdCancelInput.value = response.data.id;
    }
  } catch (error) {
    showResult({ error: error.message });
  }
});

fetchBookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bookingId = bookingIdLookupInput.value.trim();
  try {
    const response = await requestJson(`${API_BASE_URL}/api/bookings/${bookingId}`);
    showResult(response);
  } catch (error) {
    showResult({ error: error.message });
  }
});

cancelBookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bookingId = bookingIdCancelInput.value.trim();
  try {
    const response = await requestJson(`${API_BASE_URL}/api/bookings/${bookingId}`, {
      method: "DELETE",
      body: JSON.stringify({
        reason: cancelReasonInput.value.trim()
      })
    });
    showResult(response);
  } catch (error) {
    showResult({ error: error.message });
  }
});

async function loadVenues() {
  venuesEl.innerHTML = "<p>Loading venues...</p>";
  try {
    const payload = await requestJson(`${API_BASE_URL}/api/venues`);
    renderVenues(payload.data || []);
  } catch (error) {
    venuesEl.innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

function renderVenues(venues) {
  if (!venues.length) {
    venuesEl.innerHTML = "<p class='muted'>No venues yet.</p>";
    return;
  }

  venuesEl.innerHTML = "";
  for (const venue of venues) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${escapeHtml(venue.name)}</h3>
      <p class="slot-meta">${escapeHtml(venue.location)}</p>
      <p class="slot-meta">${escapeHtml(venue.sport)} | Capacity: ${venue.capacity}</p>
      <button data-venue-id="${venue.id}">View Slots</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      selectedVenueId = venue.id;
      selectedVenueText.textContent = `Selected venue: ${venue.name}`;
      loadSlots(venue.id, slotDateInput.value);
    });
    venuesEl.appendChild(card);
  }
}

async function loadSlots(venueId, date) {
  slotsEl.innerHTML = "<p>Loading slots...</p>";
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  try {
    const payload = await requestJson(`${API_BASE_URL}/api/venues/${venueId}/slots${query}`);
    renderSlots(payload.data && payload.data.slots ? payload.data.slots : []);
  } catch (error) {
    slotsEl.innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

function renderSlots(slots) {
  if (!slots.length) {
    slotsEl.innerHTML = "<p class='muted'>No slots for selected date.</p>";
    return;
  }

  slotsEl.innerHTML = "";
  for (const slot of slots) {
    const card = document.createElement("article");
    card.className = "card";
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    card.innerHTML = `
      <p class="slot-meta">${start.toLocaleString()} -> ${end.toLocaleTimeString()}</p>
      <p>Slot ID: <code>${slot.id}</code></p>
      <span class="chip ${slot.status}">${slot.status}</span>
      <div style="margin-top:10px;">
        <button ${slot.status !== "OPEN" ? "disabled" : ""}>Use Slot ID</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      slotIdInput.value = slot.id;
      showResult({ info: `Slot ${slot.id} selected for booking.` });
    });
    slotsEl.appendChild(card);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

function showResult(payload) {
  resultEl.textContent = JSON.stringify(payload, null, 2);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

loadVenues();
