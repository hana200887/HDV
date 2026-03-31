const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { randomUUID } = require("node:crypto");
const { createApp } = require("../src/createApp");

function createInMemoryVenueStore() {
  const venues = [];
  const slots = [];

  return {
    async listVenues() {
      return venues;
    },
    async getVenueById(venueId) {
      return venues.find((venue) => venue.id === venueId) || null;
    },
    async createVenue(payload) {
      const created = {
        id: randomUUID(),
        ...payload,
        createdAt: new Date().toISOString()
      };
      venues.push(created);
      return created;
    },
    async addSlots(venueId, slotPayloads) {
      const createdSlots = slotPayloads.map((slot) => ({
        id: randomUUID(),
        venueId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status || "OPEN"
      }));
      slots.push(...createdSlots);
      return createdSlots;
    },
    async listSlotsByVenue(venueId) {
      return slots.filter((slot) => slot.venueId === venueId);
    },
    async getSlotById(slotId) {
      return slots.find((slot) => slot.id === slotId) || null;
    }
  };
}

test("GET /health returns ok", async () => {
  const app = createApp({ venueStore: createInMemoryVenueStore() });
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("POST /venues creates a venue and optional slots", async () => {
  const app = createApp({ venueStore: createInMemoryVenueStore() });
  const response = await request(app).post("/venues").send({
    name: "Campus Court 1",
    location: "Area A",
    sport: "basketball",
    capacity: 20,
    slots: [
      {
        startTime: "2026-04-01T08:00:00.000Z",
        endTime: "2026-04-01T09:30:00.000Z"
      }
    ]
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.name, "Campus Court 1");
  assert.equal(response.body.data.slots.length, 1);
});

test("POST /venues validates bad input", async () => {
  const app = createApp({ venueStore: createInMemoryVenueStore() });
  const response = await request(app).post("/venues").send({
    name: "A",
    location: "B",
    sport: "chess",
    capacity: -1
  });

  assert.equal(response.status, 400);
});
