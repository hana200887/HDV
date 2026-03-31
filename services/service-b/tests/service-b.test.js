const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { randomUUID } = require("node:crypto");
const { createApp } = require("../src/createApp");

function createInMemoryBookingStore() {
  const bookings = [];
  const events = [];

  return {
    async createBooking(payload) {
      const duplicate = bookings.find(
        (booking) => booking.slotId === payload.slotId && booking.status !== "CANCELLED"
      );
      if (duplicate) {
        const error = new Error("Slot already booked");
        error.code = "SLOT_ALREADY_BOOKED";
        throw error;
      }

      const booking = {
        id: randomUUID(),
        slotId: payload.slotId,
        venueId: payload.venueId,
        userId: payload.userId,
        status: payload.status,
        cancelReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      bookings.push(booking);
      events.push({
        id: events.length + 1,
        bookingId: booking.id,
        eventType: "BOOKING_CREATED",
        payload: {
          slotId: booking.slotId,
          venueId: booking.venueId,
          status: booking.status
        },
        createdAt: new Date().toISOString()
      });

      return {
        ...booking,
        events: events.filter((event) => event.bookingId === booking.id).map(stripBookingId)
      };
    },

    async getBookingById(bookingId) {
      const booking = bookings.find((item) => item.id === bookingId);
      if (!booking) {
        return null;
      }

      return {
        ...booking,
        events: events.filter((event) => event.bookingId === bookingId).map(stripBookingId)
      };
    },

    async cancelBooking(bookingId, reason) {
      const booking = bookings.find((item) => item.id === bookingId);
      if (!booking) {
        return { error: "NOT_FOUND" };
      }
      if (booking.status === "CANCELLED") {
        return { error: "ALREADY_CANCELLED" };
      }

      booking.status = "CANCELLED";
      booking.cancelReason = reason || "Cancelled by user";
      booking.updatedAt = new Date().toISOString();

      events.push({
        id: events.length + 1,
        bookingId,
        eventType: "BOOKING_CANCELLED",
        payload: {
          reason: booking.cancelReason
        },
        createdAt: new Date().toISOString()
      });

      return {
        booking: {
          ...booking,
          events: events.filter((event) => event.bookingId === bookingId).map(stripBookingId)
        }
      };
    }
  };
}

function createStubVenueClient() {
  const slot = {
    id: "11111111-1111-1111-1111-111111111111",
    venueId: "22222222-2222-2222-2222-222222222222",
    status: "OPEN"
  };
  return {
    async getSlotById(slotId) {
      return slotId === slot.id ? slot : null;
    }
  };
}

function stripBookingId(event) {
  return {
    id: event.id,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt
  };
}

test("POST /bookings creates booking", async () => {
  const app = createApp({
    bookingStore: createInMemoryBookingStore(),
    venueClient: createStubVenueClient()
  });

  const response = await request(app).post("/bookings").send({
    slotId: "11111111-1111-1111-1111-111111111111",
    userId: "sv123456",
    status: "PENDING"
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "PENDING");
  assert.equal(response.body.data.events[0].eventType, "BOOKING_CREATED");
});

test("POST /bookings rejects duplicate active booking", async () => {
  const app = createApp({
    bookingStore: createInMemoryBookingStore(),
    venueClient: createStubVenueClient()
  });

  await request(app).post("/bookings").send({
    slotId: "11111111-1111-1111-1111-111111111111",
    userId: "sv123456",
    status: "PENDING"
  });

  const secondResponse = await request(app).post("/bookings").send({
    slotId: "11111111-1111-1111-1111-111111111111",
    userId: "sv654321",
    status: "CONFIRMED"
  });

  assert.equal(secondResponse.status, 409);
});

test("DELETE /bookings/:id cancels booking", async () => {
  const app = createApp({
    bookingStore: createInMemoryBookingStore(),
    venueClient: createStubVenueClient()
  });

  const createResponse = await request(app).post("/bookings").send({
    slotId: "11111111-1111-1111-1111-111111111111",
    userId: "sv777777",
    status: "PENDING"
  });
  const bookingId = createResponse.body.data.id;

  const cancelResponse = await request(app).delete(`/bookings/${bookingId}`).send({
    reason: "Change of plans"
  });

  assert.equal(cancelResponse.status, 200);
  assert.equal(cancelResponse.body.data.status, "CANCELLED");
});
