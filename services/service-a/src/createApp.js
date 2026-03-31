const express = require("express");

const SUPPORTED_SPORTS = new Set([
  "BASKETBALL",
  "FOOTBALL",
  "BADMINTON",
  "TENNIS",
  "VOLLEYBALL",
  "OTHER"
]);
const SLOT_STATUSES = new Set(["OPEN", "BLOCKED"]);

function createApp({ venueStore }) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/venues/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/venues", async (_req, res, next) => {
    try {
      const venues = await venueStore.listVenues();
      res.json({ data: venues });
    } catch (error) {
      next(error);
    }
  });

  app.post("/venues", async (req, res, next) => {
    try {
      const validationError = validateVenuePayload(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const venue = await venueStore.createVenue({
        name: req.body.name.trim(),
        location: req.body.location.trim(),
        sport: req.body.sport.toUpperCase(),
        capacity: req.body.capacity
      });

      const slots = Array.isArray(req.body.slots) && req.body.slots.length > 0
        ? await venueStore.addSlots(venue.id, req.body.slots)
        : [];

      return res.status(201).json({
        data: {
          ...venue,
          slots
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/venues/:venueId/slots", async (req, res, next) => {
    try {
      const { venueId } = req.params;
      const { date } = req.query;

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "date must use YYYY-MM-DD format" });
      }

      const venue = await venueStore.getVenueById(venueId);
      if (!venue) {
        return res.status(404).json({ error: "Venue not found" });
      }

      const slots = await venueStore.listSlotsByVenue(venueId, date);
      return res.json({ data: { venue, slots } });
    } catch (error) {
      next(error);
    }
  });

  app.get("/slots/:slotId", async (req, res, next) => {
    try {
      const slot = await venueStore.getSlotById(req.params.slotId);
      if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
      }

      return res.json({ data: slot });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Venue or slot already exists" });
    }

    if (error.message === "INVALID_SLOT_RANGE") {
      return res.status(400).json({ error: "slot startTime must be before endTime" });
    }

    console.error("[service-a] unexpected error", error);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

function validateVenuePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body is required";
  }

  if (typeof payload.name !== "string" || payload.name.trim().length < 3) {
    return "name must contain at least 3 characters";
  }

  if (typeof payload.location !== "string" || payload.location.trim().length < 3) {
    return "location must contain at least 3 characters";
  }

  if (typeof payload.sport !== "string" || !SUPPORTED_SPORTS.has(payload.sport.toUpperCase())) {
    return "sport is invalid";
  }

  if (!Number.isInteger(payload.capacity) || payload.capacity < 1) {
    return "capacity must be a positive integer";
  }

  if (payload.slots !== undefined) {
    if (!Array.isArray(payload.slots) || payload.slots.length === 0) {
      return "slots must be a non-empty array when provided";
    }

    for (const slot of payload.slots) {
      if (!slot || typeof slot !== "object") {
        return "each slot must be an object";
      }
      if (!isIsoDateTime(slot.startTime) || !isIsoDateTime(slot.endTime)) {
        return "slot startTime and endTime must be ISO datetime";
      }

      const status = (slot.status || "OPEN").toUpperCase();
      if (!SLOT_STATUSES.has(status)) {
        return "slot status must be OPEN or BLOCKED";
      }
    }
  }

  return null;
}

function isIsoDateTime(value) {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

module.exports = {
  createApp,
  validateVenuePayload
};
