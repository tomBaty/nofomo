# London Exhibitions App

Azure Static Web App with React frontend and Azure Functions API.


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