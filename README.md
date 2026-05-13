# London Exhibitions App

Azure Static Web App with React frontend and Azure Functions API.

## Structure

```
exhibits_london/
├── exhibits-london/    # React + Vite frontend
├── api/               # Azure Functions API
├── backend/           # Old GraphQL backend (can be removed)
└── package.json       # Root scripts
```

## Development

### First Time Setup
```bash
npm run install:all
```

### Running Locally with Azure SWA CLI

**Option 1: Combined (Recommended)**
```bash
npm run dev
```
This starts the frontend (Vite) and API (Azure Functions) together using SWA CLI.

**Option 2: Separate terminals**
```bash
# Terminal 1 - Frontend
npm run dev:frontend

# Terminal 2 - API
npm run dev:api
```

## API Endpoints

### GET /api/exhibitions

Returns all exhibitions with optional filtering.

**Query Parameters:**
- `startDate` - Filter exhibitions ending on or after this date (ISO format)
- `endDate` - Filter exhibitions starting on or before this date (ISO format)
- `venue` - Filter by venue name
- `paid` - Filter by "free" or "paid"

**Examples:**
```
/api/exhibitions
/api/exhibitions?venue=Tate Modern
/api/exhibitions?startDate=2026-05-01&endDate=2026-12-31
/api/exhibitions?paid=free
```

## Building

```bash
npm run build
```

Builds the frontend to `exhibits-london/dist/`

## Deployment

Deploy to Azure Static Web Apps using GitHub Actions or Azure CLI.
