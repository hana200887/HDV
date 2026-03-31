const { Pool } = require("pg");
const { createApp } = require("./createApp");
const { createVenueStore } = require("./venueStore");

const PORT = Number(process.env.PORT || 5000);
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://venue:venue@venue-db:5432/venue_db";

async function startServer() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const venueStore = createVenueStore(pool);

  await venueStore.init();
  await venueStore.seedDemoData();

  const app = createApp({ venueStore });
  const server = app.listen(PORT, () => {
    console.log(`[service-a] listening on port ${PORT}`);
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
  console.error("[service-a] failed to start", error);
  process.exit(1);
});
