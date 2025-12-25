# Recruiter CRM API Documentation

## Endpoint: List Recruiters

**GET** `/api/v1/recruiter-crm/recruiters`

List all recruiters in your CRM system with optional filtering and pagination.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | null | Filter by recruiter status. Valid values: `active`, `inactive`, `pending` |
| `recruiter_type` | string | No | null | Filter by recruiter type. Valid values: `internal`, `external`, `agency` |
| `company` | string | No | null | Filter by company name |
| `specialization` | string | No | null | Filter by specialization area |
| `limit` | integer | No | 50 | Maximum number of results (min: 1, max: 200) |
| `offset` | integer | No | 0 | Number of results to skip for pagination (min: 0) |

### Response Format

```json
{
  "recruiters": [],
  "total": 0,
  "limit": 50,
  "offset": 0,
  "filters": {
    "status": "active",
    "recruiter_type": "internal",
    "company": "Example Corp",
    "specialization": "Tech"
  }
}
```

### Response Fields

- `recruiters` (array): List of recruiter records matching the filters
- `total` (integer): Total count of recruiters matching the filters
- `limit` (integer): The limit value applied to the query
- `offset` (integer): The offset value applied to the query
- `filters` (object): The filters that were applied to the query

### Example Requests

#### Basic request (no filters)
```bash
GET /api/v1/recruiter-crm/recruiters
```

#### With status filter
```bash
GET /api/v1/recruiter-crm/recruiters?status=active
```

#### With multiple filters and pagination
```bash
GET /api/v1/recruiter-crm/recruiters?status=active&recruiter_type=internal&limit=25&offset=50
```

#### Search by company and specialization
```bash
GET /api/v1/recruiter-crm/recruiters?company=TechCorp&specialization=Software%20Engineering
```

### HTTP Status Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid query parameters
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error

### Implementation Notes

The current implementation returns an empty result set. In a production environment, this would:

1. Query a database (e.g., PostgreSQL, MongoDB) for recruiter records
2. Apply the specified filters to the query
3. Implement proper pagination with the limit and offset
4. Return actual recruiter data with fields like:
   - `id` - Unique identifier
   - `name` - Recruiter name
   - `email` - Contact email
   - `phone` - Contact phone
   - `company` - Associated company
   - `status` - Current status
   - `recruiter_type` - Type of recruiter
   - `specialization` - Areas of specialization
   - `created_at` - Account creation timestamp
   - `updated_at` - Last update timestamp

### Usage Example (Python with requests)

```python
import requests

# Base URL
base_url = "http://your-api-domain.com"

# Get active internal recruiters
response = requests.get(
    f"{base_url}/api/v1/recruiter-crm/recruiters",
    params={
        "status": "active",
        "recruiter_type": "internal",
        "limit": 10
    }
)

data = response.json()
print(f"Found {data['total']} recruiters")
for recruiter in data['recruiters']:
    print(f"  - {recruiter['name']} ({recruiter['company']})")
```

### Usage Example (JavaScript/TypeScript)

```typescript
// Using fetch API
const response = await fetch(
  '/api/v1/recruiter-crm/recruiters?' + new URLSearchParams({
    status: 'active',
    recruiter_type: 'internal',
    limit: '10'
  })
);

const data = await response.json();
console.log(`Found ${data.total} recruiters`);
```

## Service Layer

The endpoint uses the `RecruiterCRMService` class which provides the business logic:

```python
from services.recruiter_crm_service import RecruiterCRMService

service = RecruiterCRMService()
result = await service.list_recruiters(
    status="active",
    recruiter_type="internal",
    company=None,
    specialization=None,
    limit=50,
    offset=0
)
```

This service layer separation ensures:
- Clean separation of concerns
- Easy unit testing
- Reusability across different endpoints
- Simplified business logic updates
