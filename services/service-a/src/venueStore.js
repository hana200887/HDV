const { randomUUID } = require("node:crypto");

function createVenueStore(pool) {
  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS venues (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          location TEXT NOT NULL,
          sport TEXT NOT NULL,
          capacity INTEGER NOT NULL CHECK (capacity > 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS time_slots (
          id UUID PRIMARY KEY,
          venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
          start_time TIMESTAMPTZ NOT NULL,
          end_time TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (venue_id, start_time, end_time)
        )
      `);
    },

    async seedDemoData() {
      const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM venues");
      if (countResult.rows[0].count > 0) {
        return;
      }

      const seededVenues = [
        {
          id: randomUUID(),
          name: "PTIT Basketball Court A",
          location: "Building H - Zone A",
          sport: "BASKETBALL",
          capacity: 20
        },
        {
          id: randomUUID(),
          name: "PTIT Badminton Hall 2",
          location: "Sports Center Floor 2",
          sport: "BADMINTON",
          capacity: 12
        }
      ];

      for (const venue of seededVenues) {
        await pool.query(
          `INSERT INTO venues (id, name, location, sport, capacity)
           VALUES ($1, $2, $3, $4, $5)`,
          [venue.id, venue.name, venue.location, venue.sport, venue.capacity]
        );
      }

      const now = new Date();
      const slots = [];
      for (let dayOffset = 0; dayOffset < 2; dayOffset += 1) {
        const baseDate = new Date(now);
        baseDate.setUTCDate(now.getUTCDate() + dayOffset);
        for (const venue of seededVenues) {
          for (const hour of [8, 10, 14, 16, 18]) {
            const start = new Date(Date.UTC(
              baseDate.getUTCFullYear(),
              baseDate.getUTCMonth(),
              baseDate.getUTCDate(),
              hour,
              0,
              0
            ));
            const end = new Date(Date.UTC(
              baseDate.getUTCFullYear(),
              baseDate.getUTCMonth(),
              baseDate.getUTCDate(),
              hour + 1,
              30,
              0
            ));

            slots.push({
              id: randomUUID(),
              venueId: venue.id,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              status: "OPEN"
            });
          }
        }
      }

      for (const slot of slots) {
        await pool.query(
          `INSERT INTO time_slots (id, venue_id, start_time, end_time, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [slot.id, slot.venueId, slot.startTime, slot.endTime, slot.status]
        );
      }
    },

    async listVenues() {
      const result = await pool.query(
        `SELECT id, name, location, sport, capacity, created_at
         FROM venues
         ORDER BY created_at ASC`
      );
      return result.rows.map(mapVenueRow);
    },

    async getVenueById(venueId) {
      const result = await pool.query(
        `SELECT id, name, location, sport, capacity, created_at
         FROM venues
         WHERE id = $1`,
        [venueId]
      );
      return result.rows[0] ? mapVenueRow(result.rows[0]) : null;
    },

    async createVenue(payload) {
      const venue = {
        id: randomUUID(),
        ...payload
      };

      const result = await pool.query(
        `INSERT INTO venues (id, name, location, sport, capacity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, location, sport, capacity, created_at`,
        [venue.id, venue.name, venue.location, venue.sport, venue.capacity]
      );

      return mapVenueRow(result.rows[0]);
    },

    async addSlots(venueId, slots) {
      const createdSlots = [];
      for (const slot of slots) {
        const slotId = randomUUID();
        const status = (slot.status || "OPEN").toUpperCase();
        if (Date.parse(slot.startTime) >= Date.parse(slot.endTime)) {
          throw new Error("INVALID_SLOT_RANGE");
        }

        const result = await pool.query(
          `INSERT INTO time_slots (id, venue_id, start_time, end_time, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, venue_id, start_time, end_time, status`,
          [slotId, venueId, slot.startTime, slot.endTime, status]
        );
        createdSlots.push(mapSlotRow(result.rows[0]));
      }

      return createdSlots;
    },

    async listSlotsByVenue(venueId, date) {
      if (!date) {
        const result = await pool.query(
          `SELECT id, venue_id, start_time, end_time, status
           FROM time_slots
           WHERE venue_id = $1
           ORDER BY start_time ASC`,
          [venueId]
        );
        return result.rows.map(mapSlotRow);
      }

      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 1);

      const result = await pool.query(
        `SELECT id, venue_id, start_time, end_time, status
         FROM time_slots
         WHERE venue_id = $1
           AND start_time >= $2
           AND start_time < $3
         ORDER BY start_time ASC`,
        [venueId, start.toISOString(), end.toISOString()]
      );
      return result.rows.map(mapSlotRow);
    },

    async getSlotById(slotId) {
      const result = await pool.query(
        `SELECT id, venue_id, start_time, end_time, status
         FROM time_slots
         WHERE id = $1`,
        [slotId]
      );

      return result.rows[0] ? mapSlotRow(result.rows[0]) : null;
    }
  };
}

function mapVenueRow(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    sport: row.sport,
    capacity: Number(row.capacity),
    createdAt: row.created_at
  };
}

function mapSlotRow(row) {
  return {
    id: row.id,
    venueId: row.venue_id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status
  };
}

module.exports = {
  createVenueStore
};
