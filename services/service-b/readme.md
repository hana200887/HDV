# Service B - Booking Service

## Responsibility

Service B owns booking lifecycle data:

- Create booking for a selected slot
- Prevent double booking on active states
- Get booking details and event history
- Cancel booking and release slot for future bookings

## Tech Stack

- Node.js 20 + Express
- PostgreSQL (dedicated DB: `booking-db`)

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/bookings/health` | Gateway-friendly health alias |
| POST | `/bookings` | Create booking |
| GET | `/bookings/{bookingId}` | Get booking details |
| DELETE | `/bookings/{bookingId}` | Cancel booking |

OpenAPI: `docs/api-specs/service-b.yaml`

## Run

```bash
docker compose up service-b --build
```

## Environment

- `PORT` (default `5000`)
- `DATABASE_URL` (Postgres URL)
- `SERVICE_A_URL` (internal URL for slot lookup)

## Test

```bash
cd services/service-b
npm install
npm test
```
