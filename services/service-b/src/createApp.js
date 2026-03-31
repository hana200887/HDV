const express = require("express");

const BOOKING_STATUSES = new Set(["PENDING", "CONFIRMED", "CANCELLED"]);

function createApp({ bookingStore, venueClient }) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/bookings/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/bookings", async (req, res, next) => {
    try {
      const validationError = validateCreateBookingPayload(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const requestedStatus = (req.body.status || "PENDING").toUpperCase();
      if (!BOOKING_STATUSES.has(requestedStatus) || requestedStatus === "CANCELLED") {
        return res.status(400).json({ error: "status must be PENDING or CONFIRMED" });
      }

      const slot = await venueClient.getSlotById(req.body.slotId);
      if (!slot) {
        return res.status(404).json({ error: "Slot not found in venue service" });
      }
      if (slot.status !== "OPEN") {
        return res.status(409).json({ error: "Slot is not available for booking" });
      }

      const booking = await bookingStore.createBooking({
        slotId: req.body.slotId,
        venueId: slot.venueId,
        userId: req.body.userId,
        status: requestedStatus
      });

      return res.status(201).json({ data: booking });
    } catch (error) {
      next(error);
    }
  });

  app.get("/bookings/:bookingId", async (req, res, next) => {
    try {
      const booking = await bookingStore.getBookingById(req.params.bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      return res.json({ data: booking });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/bookings/:bookingId", async (req, res, next) => {
    try {
      const result = await bookingStore.cancelBooking(
        req.params.bookingId,
        req.body && typeof req.body.reason === "string" ? req.body.reason.trim() : null
      );

      if (result.error === "NOT_FOUND") {
        return res.status(404).json({ error: "Booking not found" });
      }
      if (result.error === "ALREADY_CANCELLED") {
        return res.status(409).json({ error: "Booking already cancelled" });
      }

      return res.json({ data: result.booking });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error.code === "SLOT_ALREADY_BOOKED") {
      return res.status(409).json({ error: "Slot already booked" });
    }

    console.error("[service-b] unexpected error", error);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

function validateCreateBookingPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body is required";
  }

  if (!isUuid(payload.slotId)) {
    return "slotId must be a valid UUID";
  }

  if (typeof payload.userId !== "string" || payload.userId.trim().length < 3) {
    return "userId must contain at least 3 characters";
  }

  return null;
}

function isUuid(value) {
  return typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
}

module.exports = {
  createApp
};
