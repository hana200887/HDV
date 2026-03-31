const API_BASE_URL = window.API_BASE_URL || "http://localhost:8080";

const venuesEl = document.getElementById("venues");
const slotsEl = document.getElementById("slots");
const resultEl = document.getElementById("result");
const resultLabelEl = document.getElementById("resultLabel");
const selectedVenueText = document.getElementById("selectedVenueText");
const slotDateInput = document.getElementById("slotDate");

const refreshAllButton = document.getElementById("refreshAll");
const refreshHealthButton = document.getElementById("refreshHealth");
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
const statTotalSlotsEl = document.getElementById("statTotalSlots");
const statHealthyServicesEl = document.getElementById("statHealthyServices");
const statSelectedVenueEl = document.getElementById("statSelectedVenue");
const statLastBookingEl = document.getElementById("statLastBooking");

const selectedVenueNameEl = document.getElementById("selectedVenueName");
const selectedVenueLocationEl = document.getElementById("selectedVenueLocation");
const selectedVenueSportEl = document.getElementById("selectedVenueSport");
const selectedVenueCapacityEl = document.getElementById("selectedVenueCapacity");
const selectedVenueCreatedEl = document.getElementById("selectedVenueCreated");

const statusGatewayEl = document.getElementById("statusGateway");
const statusVenueEl = document.getElementById("statusVenue");
const statusBookingEl = document.getElementById("statusBooking");
const infoTimezoneEl = document.getElementById("infoTimezone");
const infoDateTimeEl = document.getElementById("infoDateTime");
const lastSyncEl = document.getElementById("lastSync");

const examplePayloadEl = document.getElementById("examplePayload");
const exampleResultEl = document.getElementById("exampleResult");
const toastEl = document.getElementById("toast");

const state = {
  venues: [],
  slots: [],
  selectedVenueId: null,
  selectedSlotId: null,
  latestBookingId: null,
  serviceHealth: {
    gateway: null,
    venue: null,
    booking: null
  },
  toastTimer: null
};

const DASHBOARD_TIMEZONE = "Asia/Bangkok";

slotDateInput.value = getTodayDate(DASHBOARD_TIMEZONE);
userIdInput.value = "sv-demo-001";

wireEvents();
initialize();

function wireEvents() {
  refreshAllButton.addEventListener("click", async () => {
    await refreshDashboard({ preserveSelection: true });
  });

  refreshHealthButton.addEventListener("click", async () => {
    await refreshServiceHealth();
    markSynced("Service health refreshed");
  });

  refreshVenuesButton.addEventListener("click", async () => {
    await loadVenues({ preserveSelection: true });
    markSynced("Venue list refreshed");
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
      markSynced("Slot data updated");
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
      markSynced("Booking fetched");
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
      markSynced("Booking cancelled");
    } catch (error) {
      showResult("Cancel booking failed", { error: error.message });
      showToast(error.message, "error");
    }
  });
}

async function initialize() {
  updateClockInfo();
  setInterval(updateClockInfo, 15000);
  await refreshDashboard({ preserveSelection: false });
}

async function refreshDashboard({ preserveSelection = true } = {}) {
  showToast("Refreshing dashboard...", "success");
  await Promise.all([
    loadVenues({ preserveSelection, autoSelectFirst: true }),
    refreshServiceHealth()
  ]);
  updateExamplePayload();
  markSynced("Dashboard refreshed");
}

async function loadVenues({ preserveSelection = true, autoSelectFirst = false } = {}) {
  venuesEl.innerHTML = `<p class="hint">Loading venues...</p>`;

  try {
    const payload = await requestJson(`${API_BASE_URL}/api/venues`);
    state.venues = payload.data || [];

    const hasCurrent = preserveSelection && state.venues.some((venue) => venue.id === state.selectedVenueId);
    if (!hasCurrent) {
      state.selectedVenueId = autoSelectFirst && state.venues[0] ? state.venues[0].id : null;
    }

    renderVenues(state.venues);

    if (state.selectedVenueId) {
      const selectedVenue = state.venues.find((venue) => venue.id === state.selectedVenueId);
      selectedVenueText.textContent = selectedVenue
        ? `Selected venue: ${selectedVenue.name} (${selectedVenue.sport})`
        : "Select a venue card to load slot data.";
      updateSelectedVenueInfo(selectedVenue || null);
      await loadSlots(state.selectedVenueId, slotDateInput.value);
    } else {
      selectedVenueText.textContent = "Select a venue card to load slot data.";
      updateSelectedVenueInfo(null);
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
      <button class="btn btn-primary" data-venue-id="${venue.id}">View Slots</button>
    `;

    card.querySelector("button").addEventListener("click", async () => {
      state.selectedVenueId = venue.id;
      selectedVenueText.textContent = `Selected venue: ${venue.name} (${venue.sport})`;
      updateSelectedVenueInfo(venue);
      renderVenues(state.venues);
      await loadSlots(venue.id, slotDateInput.value);
      markSynced("Venue selected");
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
    const start = formatDateTime(slot.startTime);
    const end = formatDateTime(slot.endTime);

    const card = document.createElement("article");
    card.className = `card${slot.id === state.selectedSlotId ? " selected" : ""}`;
    card.innerHTML = `
      <p class="slot-meta"><strong>${start.date}</strong> ${start.time} - ${end.time}</p>
      <p class="slot-meta">Slot ID: <code>${slot.id}</code></p>
      <span class="chip ${slot.status}">${slot.status}</span>
      <button class="btn btn-primary" ${slot.status !== "OPEN" ? "disabled" : ""}>Use This Slot</button>
    `;

    card.querySelector("button").addEventListener("click", () => {
      applySelectedSlot(slot.id);
      showResult("Slot selected", { slotId: slot.id, status: slot.status });
      showToast("Slot selected", "success");
      markSynced("Slot selected");
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
  showToast("First open slot selected", "success");
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
    markSynced("Booking created");
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
    markSynced("Booking cancelled");
  } catch (error) {
    showResult("Cancel booking failed", { error: error.message });
    showToast(error.message, "error");
  }
}

async function runDemoFlow() {
  showToast("Running full demo flow...", "success");
  await refreshDashboard({ preserveSelection: false });
  await pickFirstOpenSlot();
  await createSampleBooking();
}

async function refreshServiceHealth() {
  const [gateway, venue, booking] = await Promise.all([
    checkServiceHealth(`${API_BASE_URL}/health`),
    checkServiceHealth(`${API_BASE_URL}/api/venues/health`),
    checkServiceHealth(`${API_BASE_URL}/api/bookings/health`)
  ]);

  state.serviceHealth = { gateway, venue, booking };
  renderServiceHealth();
  updateStats();
}

async function checkServiceHealth(url) {
  try {
    const payload = await requestJson(url);
    return payload && payload.status === "ok";
  } catch (_error) {
    return false;
  }
}

function renderServiceHealth() {
  setStatusBadge(statusGatewayEl, state.serviceHealth.gateway);
  setStatusBadge(statusVenueEl, state.serviceHealth.venue);
  setStatusBadge(statusBookingEl, state.serviceHealth.booking);
}

function setStatusBadge(element, value) {
  if (value === true) {
    element.className = "status-badge online";
    element.textContent = "ONLINE";
    return;
  }

  if (value === false) {
    element.className = "status-badge offline";
    element.textContent = "OFFLINE";
    return;
  }

  element.className = "status-badge unknown";
  element.textContent = "CHECKING";
}

function updateStats() {
  statVenueCountEl.textContent = String(state.venues.length);
  statOpenSlotsEl.textContent = String(state.slots.filter((slot) => slot.status === "OPEN").length);
  statTotalSlotsEl.textContent = String(state.slots.length);

  const healthyCount = [state.serviceHealth.gateway, state.serviceHealth.venue, state.serviceHealth.booking]
    .filter((status) => status === true)
    .length;
  statHealthyServicesEl.textContent = `${healthyCount}/3`;

  statSelectedVenueEl.textContent = state.selectedVenueId
    ? shortText((state.venues.find((venue) => venue.id === state.selectedVenueId) || {}).name || "-")
    : "-";

  statLastBookingEl.textContent = state.latestBookingId ? shortText(state.latestBookingId) : "-";
}

function updateSelectedVenueInfo(venue) {
  if (!venue) {
    selectedVenueNameEl.textContent = "No venue selected";
    selectedVenueLocationEl.textContent = "-";
    selectedVenueSportEl.textContent = "-";
    selectedVenueCapacityEl.textContent = "-";
    selectedVenueCreatedEl.textContent = "-";
    return;
  }

  selectedVenueNameEl.textContent = venue.name;
  selectedVenueLocationEl.textContent = venue.location;
  selectedVenueSportEl.textContent = venue.sport;
  selectedVenueCapacityEl.textContent = String(venue.capacity);
  selectedVenueCreatedEl.textContent = formatDateTime(venue.createdAt).full;
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
  }, 2300);
}

function updateClockInfo() {
  infoTimezoneEl.textContent = DASHBOARD_TIMEZONE;
  infoDateTimeEl.textContent = new Date().toLocaleString("vi-VN", {
    timeZone: DASHBOARD_TIMEZONE,
    hour12: false
  });
}

function markSynced(context) {
  const time = new Date().toLocaleTimeString("vi-VN", {
    timeZone: DASHBOARD_TIMEZONE,
    hour12: false
  });
  lastSyncEl.textContent = `Last sync (${context}): ${time}`;
}

function formatDateTime(value) {
  if (!value) {
    return {
      date: "-",
      time: "-",
      full: "-"
    };
  }

  const date = new Date(value);
  return {
    date: date.toLocaleDateString("vi-VN", { timeZone: DASHBOARD_TIMEZONE }),
    time: date.toLocaleTimeString("vi-VN", { timeZone: DASHBOARD_TIMEZONE, hour: "2-digit", minute: "2-digit" }),
    full: date.toLocaleString("vi-VN", { timeZone: DASHBOARD_TIMEZONE, hour12: false })
  };
}

function shortText(text) {
  if (!text) {
    return "-";
  }
  return text.length > 16 ? `${text.slice(0, 13)}...` : text;
}

function getTodayDate(timeZone) {
  const now = new Date();
  const formatted = now.toLocaleDateString("en-CA", { timeZone });
  return formatted;
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
