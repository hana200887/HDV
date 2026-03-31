const { randomUUID } = require("node:crypto");

function createBookingStore(pool) {
  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id UUID PRIMARY KEY,
          slot_id UUID NOT NULL,
          venue_id UUID NOT NULL,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
          cancel_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS booking_events (
          id BIGSERIAL PRIMARY KEY,
          booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_slot_booking
        ON bookings (slot_id)
        WHERE status IN ('PENDING', 'CONFIRMED')
      `);
    },

    async createBooking(payload) {
      const bookingId = randomUUID();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const bookingResult = await client.query(
          `INSERT INTO bookings (id, slot_id, venue_id, user_id, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, slot_id, venue_id, user_id, status, cancel_reason, created_at, updated_at`,
          [bookingId, payload.slotId, payload.venueId, payload.userId, payload.status]
        );
        const booking = mapBookingRow(bookingResult.rows[0]);

        await client.query(
          `INSERT INTO booking_events (booking_id, event_type, payload)
           VALUES ($1, $2, $3::jsonb)`,
          [
            bookingId,
            "BOOKING_CREATED",
            JSON.stringify({
              slotId: booking.slotId,
              venueId: booking.venueId,
              status: booking.status
            })
          ]
        );

        await client.query("COMMIT");
        const events = await this.listEventsByBookingId(bookingId);
        return {
          ...booking,
          events
        };
      } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") {
          const conflictError = new Error("Slot already booked");
          conflictError.code = "SLOT_ALREADY_BOOKED";
          throw conflictError;
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async getBookingById(bookingId) {
      const bookingResult = await pool.query(
        `SELECT id, slot_id, venue_id, user_id, status, cancel_reason, created_at, updated_at
         FROM bookings
         WHERE id = $1`,
        [bookingId]
      );

      if (!bookingResult.rows[0]) {
        return null;
      }

      const booking = mapBookingRow(bookingResult.rows[0]);
      const events = await this.listEventsByBookingId(bookingId);
      return {
        ...booking,
        events
      };
    },

    async cancelBooking(bookingId, reason) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const currentResult = await client.query(
          `SELECT id, slot_id, venue_id, user_id, status, cancel_reason, created_at, updated_at
           FROM bookings
           WHERE id = $1
           FOR UPDATE`,
          [bookingId]
        );

        if (!currentResult.rows[0]) {
          await client.query("ROLLBACK");
          return { error: "NOT_FOUND" };
        }

        const current = mapBookingRow(currentResult.rows[0]);
        if (current.status === "CANCELLED") {
          await client.query("ROLLBACK");
          return { error: "ALREADY_CANCELLED" };
        }

        const updatedResult = await client.query(
          `UPDATE bookings
           SET status = 'CANCELLED',
               cancel_reason = $2,
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, slot_id, venue_id, user_id, status, cancel_reason, created_at, updated_at`,
          [bookingId, reason || "Cancelled by user"]
        );

        await client.query(
          `INSERT INTO booking_events (booking_id, event_type, payload)
           VALUES ($1, $2, $3::jsonb)`,
          [
            bookingId,
            "BOOKING_CANCELLED",
            JSON.stringify({
              reason: reason || "Cancelled by user"
            })
          ]
        );

        await client.query("COMMIT");
        const booking = mapBookingRow(updatedResult.rows[0]);
        const events = await this.listEventsByBookingId(bookingId);
        return {
          booking: {
            ...booking,
            events
          }
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listEventsByBookingId(bookingId) {
      const result = await pool.query(
        `SELECT id, event_type, payload, created_at
         FROM booking_events
         WHERE booking_id = $1
         ORDER BY id ASC`,
        [bookingId]
      );

      return result.rows.map((row) => ({
        id: Number(row.id),
        eventType: row.event_type,
        payload: row.payload,
        createdAt: row.created_at
      }));
    }
  };
}

function mapBookingRow(row) {
  return {
    id: row.id,
    slotId: row.slot_id,
    venueId: row.venue_id,
    userId: row.user_id,
    status: row.status,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  createBookingStore
};
