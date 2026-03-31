# CampusCourt - Microservices Mid-Project

CampusCourt is a microservices-based student sports venue booking system.
Users can browse venues, view time slots, create bookings, and cancel bookings.

## Team Members

| Name | Student ID | Role | Contribution |
|------|------------|------|-------------|
| ... | ... | ... | ... |

## System Overview

- Frontend: Student booking dashboard (vanilla HTML/CSS/JS)
- Gateway: Single API entry point and routing
- Service A (Venue Service): Venue + time slot management
- Service B (Booking Service): Booking lifecycle and booking events
- Database per service: separate PostgreSQL instances for service-a and service-b

## Project Structure

```text
.
|- frontend/
|- gateway/
|- services/
|  |- service-a/
|  |- service-b/
|- docs/
|  |- analysis-and-design.md
|  |- architecture.md
|  |- api-specs/
|- docker-compose.yml
|- .env.example
```

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

After services are up:

- Frontend: http://localhost:3000
- Gateway: http://localhost:8080
- Venue Service: http://localhost:5001
- Booking Service: http://localhost:5002

## Core API Paths (via Gateway)

- `GET /api/venues`
- `GET /api/venues/{venueId}/slots?date=YYYY-MM-DD`
- `POST /api/venues`
- `POST /api/bookings`
- `GET /api/bookings/{bookingId}`
- `DELETE /api/bookings/{bookingId}`

## Development Commands

```bash
make init
make up
make down
make logs
make test
```

## Health Checks

- `GET /health` on service-a and service-b returns `{ "status": "ok" }`
- Gateway health: `GET /health`

## Assignment Checklist Mapping

- Full stack starts with `docker compose up --build`
- Frontend communicates only with Gateway
- Each backend service has independent database
- OpenAPI specs are available in `docs/api-specs/`
- Analysis and architecture docs are completed in `docs/`
- Unit/integration-oriented API tests are included in each service
