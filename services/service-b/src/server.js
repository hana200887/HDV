const { Pool } = require("pg");
const { createApp } = require("./createApp");
const { createBookingStore } = require("./bookingStore");
const { createVenueClient } = require("./venueClient");

const PORT = Number(process.env.PORT || 5000);
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://booking:booking@booking-db:5432/booking_db";
const SERVICE_A_URL = process.env.SERVICE_A_URL || "http://service-a:5000";

async function startServer() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const bookingStore = createBookingStore(pool);
  await bookingStore.init();

  const venueClient = createVenueClient({ serviceAUrl: SERVICE_A_URL });
  const app = createApp({ bookingStore, venueClient });
  const server = app.listen(PORT, () => {
    console.log(`[service-b] listening on port ${PORT}`);
  });

  const gracefulShutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
}

startServer().catch((error) => {
  console.error("[service-b] failed to start", error);
  process.exit(1);
});
