# FastAPI Jobs API - Fixed Implementation

This example demonstrates the fix for the issue where an unimplemented endpoint was causing cascading errors.

## Problem Statement

The original issue was:
- `/api/v1/jobs/{job_id}` endpoint raised a 501 "Not Implemented" HTTPException
- When internal application logic tried to call this endpoint, the unhandled exception propagated
- This caused the entire request to fail with a 500 Internal Server Error
- The actual 501 error was masked by the 500 error

## Root Cause

```python
# BEFORE (problematic code):
@router.get("/{job_id}")
async def get_job_by_id(job_id: str):
    raise HTTPException(
        status_code=501,
        detail="Job detail lookup not yet implemented - use /jobs/search instead"
    )
```

The issues with this approach:
1. The endpoint returned a 501 error instead of being properly implemented
2. No global exception handlers were catching the HTTPException
3. Internal API calls didn't handle the exception gracefully
4. The 501 error cascaded into a 500 error for the end user

## Solution

The fix includes three key components:

### 1. Proper Endpoint Implementation

Instead of raising a 501 error, the endpoint now properly fetches and returns job data:

```python
@router.get("/{job_id}", response_model=Job)
async def get_job_by_id(job_id: str):
    job = MOCK_JOBS.get(job_id)
    
    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Job with id '{job_id}' not found."
        )
    
    return job
```

### 2. Global Exception Handlers

Added global exception handlers to catch and properly format all HTTPExceptions:

```python
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "request_id": request_id,
            "path": str(request.url.path)
        }
    )
```

### 3. Request Tracking Middleware

Added middleware to track requests and ensure proper logging:

```python
@app.middleware("http")
async def add_request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    # ... logging and error handling
```

## Project Structure

```
fastapi_jobs_api/
├── api/
│   ├── __init__.py
│   └── routes/
│       ├── __init__.py
│       └── jobs.py          # Job endpoints with proper implementation
├── main.py                  # Application with global error handlers
├── test_main.py            # Comprehensive test suite
├── requirements.txt        # Dependencies
└── README.md              # This file
```

## Installation

```bash
cd examples/fastapi_jobs_api
pip install -r requirements.txt
```

## Running the Application

```bash
uvicorn main:app --reload
```

The API will be available at http://localhost:8000

## API Endpoints

### Health Check
```
GET /health
```

### Job Search
```
GET /api/v1/jobs/search?query=python&location=San+Francisco&remote=true
```

Parameters:
- `query` (optional): Search term
- `location` (optional): Location filter
- `remote` (optional): Remote work filter (true/false)
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Results per page (default: 10)

### Job Detail
```
GET /api/v1/jobs/{job_id}
```

Example:
```
GET /api/v1/jobs/job_001
```

## Running Tests

```bash
pytest test_main.py -v
```

## Test Coverage

The test suite includes:

1. **Basic functionality tests**: Verify endpoints work correctly
2. **Error handling tests**: Ensure errors are handled properly
3. **Pagination tests**: Verify search pagination works
4. **Filter tests**: Test all search filters
5. **Critical test**: Verify 501/404 errors don't cascade to 500 errors

## Key Improvements

### Before the Fix
- ❌ `/api/v1/jobs/{job_id}` raised 501 error
- ❌ No global exception handling
- ❌ Errors cascaded to 500 Internal Server Error
- ❌ Poor error messages for users

### After the Fix
- ✅ `/api/v1/jobs/{job_id}` properly implemented
- ✅ Global exception handlers catch all HTTPExceptions
- ✅ Proper error responses with request tracking
- ✅ Clear, actionable error messages
- ✅ No cascading errors

## API Documentation

Once the application is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Example Usage

### Search for Python jobs
```bash
curl "http://localhost:8000/api/v1/jobs/search?query=python"
```

### Get a specific job
```bash
curl "http://localhost:8000/api/v1/jobs/job_001"
```

### Search with multiple filters
```bash
curl "http://localhost:8000/api/v1/jobs/search?query=engineer&location=San+Francisco&remote=true"
```

## Error Response Format

All errors return a consistent JSON format:

```json
{
  "detail": "Error message",
  "status_code": 404,
  "request_id": "a1b2c3d4",
  "path": "/api/v1/jobs/nonexistent"
}
```

## Integration with Sentry

This application is designed to integrate with Sentry for error monitoring. The fixed implementation ensures:

1. Proper error tracking with request IDs
2. Clear error messages in Sentry events
3. No cascading errors that mask root causes
4. Structured logging for debugging
