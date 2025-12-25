# Quick Start Guide

## Installation

```bash
cd /workspace/examples/fastapi_jobs_api
pip install -r requirements.txt
```

## Running the Application

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Root**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## Testing the Fix

### Run All Tests
```bash
pytest test_main.py -v
```

### Run Specific Tests
```bash
# Test the critical fix
pytest test_main.py::TestErrorHandling::test_no_cascading_errors -v

# Test job detail endpoint
pytest test_main.py::TestJobsAPI::test_job_detail_success -v

# Test job search
pytest test_main.py::TestJobsAPI::test_job_search_basic -v
```

## API Usage Examples

### 1. Health Check
```bash
curl http://localhost:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "jobs-api",
  "version": "1.0.0"
}
```

### 2. Get Job by ID (Fixed Endpoint)
```bash
curl http://localhost:8000/api/v1/jobs/job_001
```

**Response:**
```json
{
  "id": "job_001",
  "title": "Senior Software Engineer",
  "company": "Tech Corp",
  "location": "San Francisco, CA",
  "remote": true,
  "description": "We're looking for an experienced software engineer...",
  "salary_range": "$150k-$200k"
}
```

### 3. Search All Jobs
```bash
curl http://localhost:8000/api/v1/jobs/search
```

### 4. Search with Query
```bash
curl "http://localhost:8000/api/v1/jobs/search?query=python"
```

### 5. Search with Multiple Filters
```bash
curl "http://localhost:8000/api/v1/jobs/search?query=engineer&location=San+Francisco&remote=true"
```

### 6. Search with Pagination
```bash
curl "http://localhost:8000/api/v1/jobs/search?page=1&per_page=2"
```

### 7. Test Error Handling (Job Not Found)
```bash
curl http://localhost:8000/api/v1/jobs/nonexistent
```

**Response:**
```json
{
  "detail": "Job with id 'nonexistent' not found. Use /api/v1/jobs/search to find available jobs.",
  "status_code": 404,
  "request_id": "a1b2c3d4",
  "path": "/api/v1/jobs/nonexistent"
}
```

## Available Job IDs

The mock database contains these job IDs:
- `job_001` - Senior Software Engineer (San Francisco, Remote)
- `job_002` - Python Developer (Remote)
- `job_003` - Backend Engineer (New York, Non-remote)

## Key Features Demonstrated

✅ **Proper endpoint implementation** - No more 501 errors  
✅ **Global exception handling** - All errors handled gracefully  
✅ **Request tracking** - Every response includes `X-Request-ID` header  
✅ **Structured logging** - All requests/errors logged with context  
✅ **No error cascading** - 404s don't become 500s  
✅ **Clear error messages** - Users get actionable feedback  

## Verifying the Fix

### Before the Fix
```bash
# Would have returned 501 or 500
curl http://localhost:8000/api/v1/jobs/job_001
```

### After the Fix
```bash
# Now returns proper job data with 200
curl http://localhost:8000/api/v1/jobs/job_001

# Returns 404 (not 500!) for missing jobs
curl http://localhost:8000/api/v1/jobs/nonexistent
```

## Response Headers

Every response includes:
- `X-Request-ID`: Unique identifier for request tracking
- `Content-Type`: application/json

Example:
```
HTTP/1.1 200 OK
content-type: application/json
x-request-id: a1b2c3d4
```

## Error Response Format

All errors follow this consistent format:
```json
{
  "detail": "Error description",
  "status_code": 404,
  "request_id": "a1b2c3d4",
  "path": "/api/v1/jobs/nonexistent"
}
```

## Logs

The application logs all requests:

```
[a1b2c3d4] INFO - → GET /api/v1/jobs/job_001
[a1b2c3d4] INFO - ← 200
```

Errors are logged with full context:
```
[e5f6g7h8] WARNING - HTTP Exception: 404 - Job with id 'nonexistent' not found
```

## Integration with Sentry

To integrate with Sentry, add this to `main.py`:

```python
import sentry_sdk

sentry_sdk.init(
    dsn="your-dsn-here",
    traces_sample_rate=1.0,
)
```

The request IDs will be automatically included in Sentry events for easy correlation.

## Next Steps

1. Review the code in `api/routes/jobs.py` - see the proper implementation
2. Review `main.py` - see the global exception handlers
3. Review `test_main.py` - see comprehensive test coverage
4. Read `BEFORE_AND_AFTER.md` - understand the fix in detail
5. Read `ISSUE_FIX_SUMMARY.md` - complete documentation

## Support

For more details, see:
- `README.md` - Full documentation
- `BEFORE_AND_AFTER.md` - Detailed before/after comparison
- `ISSUE_FIX_SUMMARY.md` - Complete issue analysis
