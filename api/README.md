# Jobs API

## Overview

This API module provides endpoints for listing and searching job postings from various sources.

## Recent Bug Fix

### AttributeError: 'dict' object has no attribute 'lower'

**Issue:** The job normalization function was failing when the `location` field in job data was a dictionary instead of a string.

**Root Cause:** 
- The upstream data source changed the schema for the `location` field from a simple string to a structured dictionary
- The normalization code assumed `location` was always a string and called `.lower()` on it
- When the location was a dictionary, this caused: `AttributeError: 'dict' object has no attribute 'lower'`

**Solution:**
Created helper functions to handle both legacy string format and new dictionary format:

1. **`_extract_location_string(location_data)`** - Extracts a string representation from location data
   - Handles both string and dictionary formats
   - Prefers `raw_location` field, then `city`, then constructs from available fields
   - Returns empty string for invalid data

2. **`_is_remote_location(location_data)`** - Determines if a location represents a remote position
   - Checks `is_remote` field in dictionary format
   - Falls back to checking for 'remote' keyword in location string
   - Handles both string and dictionary formats

**Changes Made:**
- Modified `normalize_job_data()` to use the new helper functions
- Maintained backward compatibility with string-based location data
- Added comprehensive test coverage for both formats

## Location Data Formats

### Legacy Format (String)
```python
{
    "location": "Remote"  # Simple string
}
```

### New Format (Dictionary)
```python
{
    "location": {
        "city": "Remote",
        "country": "US",
        "is_remote": True,
        "raw_location": "Remote",
        "state": None
    }
}
```

## API Functions

### `normalize_job_data(raw_job: Dict[str, Any]) -> JobData`

Normalizes raw job data from various sources into a consistent format.

**Parameters:**
- `raw_job`: Raw job dictionary from external source

**Returns:**
- `JobData` object with normalized fields

**Example:**
```python
from api.routes.jobs import normalize_job_data

raw_job = {
    "id": "job_123",
    "title": "Software Engineer",
    "company": "TechCorp",
    "location": {
        "city": "San Francisco",
        "state": "CA",
        "country": "US",
        "is_remote": False
    },
    # ... other fields
}

normalized = normalize_job_data(raw_job)
print(normalized.location)  # "San Francisco"
print(normalized.remote)     # False
```

### `list_jobs(keywords=None, location=None, limit=10) -> List[Dict[str, Any]]`

Lists jobs based on search criteria.

**Parameters:**
- `keywords`: Search keywords for job title/description (optional)
- `location`: Location filter (optional)
- `limit`: Maximum number of jobs to return (default: 10)

**Returns:**
- List of normalized job dictionaries

### `search_jobs(criteria: Dict[str, Any]) -> List[Dict[str, Any]]`

Searches for jobs based on complex criteria.

**Parameters:**
- `criteria`: Dictionary containing search criteria (keywords, location, limit, etc.)

**Returns:**
- List of matching job dictionaries

## Testing

Run the test suite to verify functionality:

```bash
# Run all tests
python3 tests/test_jobs.py

# Run error reproduction tests
python3 tests/test_jobs_error_reproduction.py
```

All tests include coverage for:
- Dictionary location format
- String location format
- Remote detection logic
- Edge cases (missing fields, empty data, etc.)
