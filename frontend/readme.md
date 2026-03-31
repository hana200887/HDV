# Frontend (CampusCourt Dashboard)

## Overview

This frontend is a single-page dashboard for students to:

- browse available sports venues
- view slots by date
- create booking requests
- lookup and cancel bookings

All requests are sent to the API Gateway (`http://localhost:8080`).

## Tech Stack

- HTML5 + Vanilla JavaScript
- Custom CSS
- Nginx container for static hosting

## Run

```bash
docker compose up frontend --build
```

## Files

- `src/index.html` - page layout
- `src/styles.css` - visual design
- `src/app.js` - API calls and state handling
- `nginx.conf` - frontend container server config

## API Base URL

Default base URL is `http://localhost:8080` (configured in `src/app.js`).
