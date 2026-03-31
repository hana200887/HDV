const API_BASE_URL = window.API_BASE_URL || "http://localhost:8080";

const venuesEl = document.getElementById("venues");
const slotsEl = document.getElementById("slots");
const resultEl = document.getElementById("result");
const resultLabelEl = document.getElementById("resultLabel");
const selectedVenueText = document.getElementById("selectedVenueText");
const slotDateInput = document.getElementById("slotDate");

const refreshAllButton = document.getElementById("refreshAll");
const refreshVenuesButton = document.getElementById("refreshVenues");
const runDemoButton = document.getElementById("runDemo");
const demoPickSlotButton = document.getElementById("demoPickSlot");
const demoCreateButton = document.getElementById("demoCreate");
const demoCancelButton = document.getElementById("demoCancel");

const bookingForm = document.getElementById("bookingForm");
const fetchBookingForm = document.getElementById("fetchBookingForm");
const cancelBookingForm = document.getElementById("cancelBookingForm");

const slotIdInput = document.getElementById("slotId");
const userIdInput = document.getElementById("userId");
const statusSelect = document.getElementById("status");
const bookingIdLookupInput = document.getElementById("bookingIdLookup");
const bookingIdCancelInput = document.getElementById("bookingIdCancel");
const cancelReasonInput = document.getElementById("cancelReason");

const statVenueCountEl = document.getElementById("statVenueCount");
const statOpenSlotsEl = document.getElementById("statOpenSlots");
const statLastBookingEl = document.getElementById("statLastBooking");

const examplePayloadEl = document.getElementById("examplePayload");
const exampleResultEl = document.getElementById("exampleResult");
const toastEl = document.getElementById("toast");

const state = {
  venues: [],
  slots: [],
  selectedVenueId: null,
  selectedSlotId: null,
  latestBookingId: null,
  toastTimer: null
};

const now = new Date();
slotDateInput.value = now.toISOString().slice(0, 10);
userIdInput.value = "sv-demo-001";

wireEvents();
initialize();

function wireEvents() {
  refreshAllButton.addEventListener("click", async () => {
    await refreshDashboard();
  });

  refreshVenuesButton.addEventListener("click", async () => {
    await loadVenues({ preserveSelection: true });
  });

  runDemoButton.addEventListener("click", async () => {
    await runDemoFlow();
  });

  demoPickSlotButton.addEventListener("click", async () => {
    await pickFirstOpenSlot();
  });

  demoCreateButton.addEventListener("click", async () => {
    await createSampleBooking();
  });

  demoCancelButton.addEventListener("click", async () => {
    await cancelLatestBooking();
  });

  slotDateInput.addEventListener("change", async () => {
    if (state.selectedVenueId) {
      await loadSlots(state.selectedVenueId, slotDateInput.value);
    }
  });

  slotIdInput.addEventListener("input", () => {
    state.selectedSlotId = slotIdInput.value.trim() || null;
    updateExamplePayload();
  });

  userIdInput.addEventListener("input", updateExamplePayload);
  statusSelect.addEventListener("change", updateExamplePayload);

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createBookingFromForm();
  });

  fetchBookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const bookingId = bookingIdLookupInput.value.trim();
    if (!bookingId) {
      showToast("Please enter booking ID", "error");
      return;
    }

    try {
      const response = await requestJson(`${API_BASE_URL}/api/bookings/${bookingId}`);
      showResult("Booking loaded", response);
      showToast("Booking details loaded", "success");
    } catch (error) {
      showResult("Get booking failed", { error: error.message });
      showToast(error.message, "error");
    }
  });

  cancelBookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const bookingId = bookingIdCancelInput.value.trim();
    if (!bookingId) {
      showToast("Please enter booking ID", "error");
      return;
    }

    try {
      const response = await requestJson(`${API_BASE_URL}/api/bookings/${bookingId}`, {
        method: "DELETE",
        body: JSON.stringify({
          reason: cancelReasonInput.value.trim() || "Cancelled from dashboard"
        })
      });

      state.latestBookingId = response.data.id;
      updateStats();
      showResult("Booking cancelled", response);
      exampleResultEl.textContent = JSON.stringify(response, null, 2);
      showToast("Booking cancelled", "success");
    } catch (error) {
      showResult("Cancel booking failed", { error: error.message });
      showToast(error.message, "error");
    }
  });
}

async function initialize() {
  await refreshDashboard();
}

async function refreshDashboard() {
  showToast("Refreshing dashboard...", "success");
  await loadVenues({ preserveSelection: false, autoSelectFirst: true });
  updateExamplePayload();
}

async function loadVenues({ preserveSelection = true, autoSelectFirst = false } = {}) {
  venuesEl.innerHTML = `<p class="hint">Loading venues...</p>`;

  try {
    const payload = await requestJson(`${API_BASE_URL}/api/venues`);
    state.venues = payload.data || [];

    const isCurrentVenueValid = preserveSelection && state.venues.some((venue) => venue.id === state.selectedVenueId);
    if (!isCurrentVenueValid) {
      state.selectedVenueId = autoSelectFirst && state.venues[0] ? state.venues[0].id : null;
    }

    renderVenues(state.venues);

    if (state.selectedVenueId) {
      const selectedVenue = state.venues.find((venue) => venue.id === state.selectedVenueId);
      selectedVenueText.textContent = selectedVenue
        ? `Selected venue: ${selectedVenue.name} (${selectedVenue.sport})`
        : "Select a venue card to view slots.";
      await loadSlots(state.selectedVenueId, slotDateInput.value);
    } else {
      selectedVenueText.textContent = "Select a venue card to view slots.";
      state.slots = [];
      renderSlots([]);
      updateStats();
    }
  } catch (error) {
    venuesEl.innerHTML = `<p class="hint">${escapeHtml(error.message)}</p>`;
    showToast(error.message, "error");
  }
}

function renderVenues(venues) {
  if (!venues.length) {
    venuesEl.innerHTML = `<p class="hint">No venues available.</p>`;
    updateStats();
    return;
  }

  venuesEl.innerHTML = "";
  for (const venue of venues) {
    const card = document.createElement("article");
    card.className = `card${venue.id === state.selectedVenueId ? " selected" : ""}`;
    card.innerHTML = `
      <h3>${escapeHtml(venue.name)}</h3>
      <p class="slot-meta">${escapeHtml(venue.location)}</p>
      <p class="slot-meta"><strong>${escapeHtml(venue.sport)}</strong> | Capacity: ${venue.capacity}</p>
      <button class="btn btn-secondary" data-venue-id="${venue.id}">View Slots</button>
    `;

    card.querySelector("button").addEventListener("click", async () => {
      state.selectedVenueId = venue.id;
      selectedVenueText.textContent = `Selected venue: ${venue.name} (${venue.sport})`;
      renderVenues(state.venues);
      await loadSlots(venue.id, slotDateInput.value);
    });

    venuesEl.appendChild(card);
  }

  updateStats();
}

async function loadSlots(venueId, date) {
  slotsEl.innerHTML = `<p class="hint">Loading slots...</p>`;
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  try {
    const payload = await requestJson(`${API_BASE_URL}/api/venues/${venueId}/slots${query}`);
    state.slots = payload.data && payload.data.slots ? payload.data.slots : [];

    if (state.selectedSlotId && !state.slots.some((slot) => slot.id === state.selectedSlotId)) {
      state.selectedSlotId = null;
      slotIdInput.value = "";
    }

    renderSlots(state.slots);
    updateStats();
    updateExamplePayload();
  } catch (error) {
    slotsEl.innerHTML = `<p class="hint">${escapeHtml(error.message)}</p>`;
    showToast(error.message, "error");
  }
}

function renderSlots(slots) {
  if (!slots.length) {
    slotsEl.innerHTML = `<p class="hint">No slots for this date.</p>`;
    updateStats();
    return;
  }

  slotsEl.innerHTML = "";
  for (const slot of slots) {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);

    const card = document.createElement("article");
    card.className = `card${slot.id === state.selectedSlotId ? " selected" : ""}`;
    card.innerHTML = `
      <p class="slot-meta"><strong>${start.toLocaleDateString()}</strong> ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      <p class="slot-meta">Slot ID: <code>${slot.id}</code></p>
      <span class="chip ${slot.status}">${slot.status}</span>
      <button class="btn btn-secondary" ${slot.status !== "OPEN" ? "disabled" : ""}>Use This Slot</button>
    `;

    card.querySelector("button").addEventListener("click", () => {
      applySelectedSlot(slot.id);
      showToast("Slot selected", "success");
      showResult("Slot selected", { slotId: slot.id, status: slot.status });
    });

    slotsEl.appendChild(card);
  }
}

function applySelectedSlot(slotId) {
  state.selectedSlotId = slotId;
  slotIdInput.value = slotId;
  renderSlots(state.slots);
  updateStats();
  updateExamplePayload();
}

async function pickFirstOpenSlot() {
  if (!state.selectedVenueId) {
    await loadVenues({ preserveSelection: false, autoSelectFirst: true });
  }

  if (!state.slots.length && state.selectedVenueId) {
    await loadSlots(state.selectedVenueId, slotDateInput.value);
  }

  const firstOpen = state.slots.find((slot) => slot.status === "OPEN");
  if (!firstOpen) {
    showToast("No open slot found for current filter", "error");
    return;
  }

  applySelectedSlot(firstOpen.id);
  showResult("First open slot selected", { slotId: firstOpen.id });
}

async function createBookingFromForm() {
  const payload = {
    userId: userIdInput.value.trim(),
    slotId: slotIdInput.value.trim(),
    status: statusSelect.value
  };

  if (!payload.userId || !payload.slotId) {
    showToast("User ID and Slot ID are required", "error");
    return;
  }

  try {
    const response = await requestJson(`${API_BASE_URL}/api/bookings`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    state.latestBookingId = response.data.id;
    bookingIdLookupInput.value = response.data.id;
    bookingIdCancelInput.value = response.data.id;

    updateStats();
    showResult("Booking created", response);
    exampleResultEl.textContent = JSON.stringify(response, null, 2);
    showToast("Booking created successfully", "success");
  } catch (error) {
    showResult("Create booking failed", { error: error.message });
    showToast(error.message, "error");
  }
}

async function createSampleBooking() {
  if (!state.selectedSlotId) {
    await pickFirstOpenSlot();
  }

  if (!state.selectedSlotId) {
    return;
  }

  userIdInput.value = `sv-demo-${Math.floor(Math.random() * 900 + 100)}`;
  statusSelect.value = "PENDING";
  updateExamplePayload();
  await createBookingFromForm();
}

async function cancelLatestBooking() {
  const bookingId = state.latestBookingId || bookingIdCancelInput.value.trim();
  if (!bookingId) {
    showToast("No booking available to cancel", "error");
    return;
  }

  bookingIdCancelInput.value = bookingId;
  cancelReasonInput.value = cancelReasonInput.value.trim() || "Demo cancellation";

  try {
    const response = await requestJson(`${API_BASE_URL}/api/bookings/${bookingId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: cancelReasonInput.value })
    });

    state.latestBookingId = response.data.id;
    updateStats();
    showResult("Latest booking cancelled", response);
    exampleResultEl.textContent = JSON.stringify(response, null, 2);
    showToast("Latest booking cancelled", "success");
  } catch (error) {
    showResult("Cancel booking failed", { error: error.message });
    showToast(error.message, "error");
  }
}

async function runDemoFlow() {
  showToast("Running full demo flow...", "success");
  await refreshDashboard();
  await pickFirstOpenSlot();
  await createSampleBooking();
}

function updateStats() {
  statVenueCountEl.textContent = String(state.venues.length);
  const openSlots = state.slots.filter((slot) => slot.status === "OPEN").length;
  statOpenSlotsEl.textContent = String(openSlots);
  statLastBookingEl.textContent = state.latestBookingId ? shortId(state.latestBookingId) : "-";
}

function updateExamplePayload() {
  const payload = {
    slotId: state.selectedSlotId || "<auto from selected slot>",
    userId: userIdInput.value.trim() || "sv-demo-001",
    status: statusSelect.value || "PENDING"
  };
  examplePayloadEl.textContent = JSON.stringify(payload, null, 2);
}

function showResult(label, payload) {
  resultLabelEl.textContent = label;
  resultEl.textContent = JSON.stringify(payload, null, 2);
}

function showToast(message, variant = "success") {
  toastEl.textContent = message;
  toastEl.className = `toast ${variant} show`;

  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }

  state.toastTimer = setTimeout(() => {
    toastEl.className = `toast ${variant}`;
  }, 2200);
}

function shortId(value) {
  if (!value) {
    return "-";
  }
  return `${value.slice(0, 8)}...`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
