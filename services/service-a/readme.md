# Service A - Venue Service

## Responsibility

Service A owns venue and time-slot data:

- Venue catalog (name, location, sport, capacity)
- Slot inventory per venue
- Slot lookup used by Booking Service

## Tech Stack

- Node.js 20 + Express
- PostgreSQL (dedicated DB: `venue-db`)

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/venues/health` | Gateway-friendly health alias |
| GET | `/venues` | List all venues |
| POST | `/venues` | Create venue (optionally include slots) |
| GET | `/venues/{venueId}/slots` | List slots for a venue (optional `date`) |
| GET | `/slots/{slotId}` | Internal slot lookup |

OpenAPI: `docs/api-specs/service-a.yaml`

## Run

```bash
docker compose up service-a --build
```

## Environment

- `PORT` (default `5000`)
- `DATABASE_URL` (Postgres URL)

## Test

```bash
cd services/service-a
npm install
npm test
```
