# API Gateway

## Overview

Gateway is the single public entry point for frontend clients.
It forwards API traffic to backend services and handles CORS.

## Routing

| Public Path | Target Service | Upstream Path |
|-------------|----------------|---------------|
| `/api/venues/*` | service-a | `/venues/*` |
| `/api/bookings/*` | service-b | `/bookings/*` |

## Health

- `GET /health` -> `{ "status": "ok" }`

## Run

```bash
docker compose up gateway --build
```

## Environment Variables

- `PORT` (default `8000`)
- `SERVICE_A_URL` (default `http://service-a:5000`)
- `SERVICE_B_URL` (default `http://service-b:5000`)
