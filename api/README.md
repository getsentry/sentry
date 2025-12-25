# Jobs API - Bug Fix Documentation

This directory contains the Jobs API with a fix for the HTTPException error: `'dict' object has no attribute 'lower'`

## Issue Fixed

**Problem:** The job search API was failing when processing job data where the `location` field was a dictionary instead of a string.

**Error:** `HTTPException: Job search failed: 'dict' object has no attribute 'lower'`

**Solution:** Updated `normalize_job_data()` function to handle both string and dictionary location formats.

## Files

- `main.py` - FastAPI application entry point
- `routes/jobs.py` - Job API endpoints with the bug fix
- `test_fix.py` - Unit tests for the normalize function
- `test_api_endpoint.py` - Full API integration tests
- `test_exact_error_scenario.py` - Test with exact error data from Sentry
- `FIX_SUMMARY.md` - Detailed fix documentation

## Running Tests

```bash
# Test the normalize function fix
python3 api/test_fix.py

# Test the full API endpoints
python3 api/test_api_endpoint.py

# Test with exact error scenario from Sentry
python3 api/test_exact_error_scenario.py
```

## The Fix

The key change was in `normalize_job_data()`:

**Before (Buggy):**
```python
location=raw_job.get('location', ''),
remote=raw_job.get('remote', False) or raw_job.get('location', '').lower() == 'remote'
```

**After (Fixed):**
```python
# Handle location - can be string or dict
location_data = raw_job.get('location', '')
if isinstance(location_data, dict):
    location_str = location_data.get('raw_location') or f"{location_data.get('city', '')}, {location_data.get('state', '')}".strip(', ')
    is_remote = location_data.get('is_remote', False)
else:
    location_str = location_data
    is_remote = location_str.lower() == 'remote' if location_str else False

# Use in Job creation:
location=location_str,
remote=raw_job.get('remote', is_remote)
```

## Test Results

All tests pass:
- ✅ Unit tests (4/4 passed)
- ✅ API integration tests (3/3 passed)
- ✅ Exact error scenario test (passed)

## Usage

Start the API server:
```bash
cd /workspace
python3 -m api.main
# Or with uvicorn:
uvicorn api.main:app --reload
```

Make requests:
```bash
# POST request
curl -X POST http://localhost:8000/api/v1/jobs/search \
  -H "Content-Type: application/json" \
  -d '{"keywords": "python", "location": "San Francisco", "limit": 10}'

# GET request
curl "http://localhost:8000/api/v1/jobs?keywords=python&location=remote&limit=10"
```

## Impact

- **Before:** 500 Internal Server Error when location was a dict
- **After:** 200 OK with proper data handling for all location formats

The fix ensures compatibility with different data sources that may provide location as either:
1. A simple string (e.g., "Remote", "San Francisco")
2. A structured dictionary with city, state, country, and remote status
