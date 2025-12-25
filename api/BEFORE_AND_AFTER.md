# Before and After: The Bug Fix

## Overview

This document shows the exact code changes made to fix the `AttributeError: 'dict' object has no attribute 'lower'` bug.

## The Bug Location

**File:** `api/routes/jobs.py`  
**Function:** `normalize_job_data()`  
**Line:** 168 (in original buggy version)

## Before: The Buggy Code

```python
def normalize_job_data(raw_job: Dict[str, Any]) -> Job:
    """
    Normalize job data from various sources into our Job model.
    
    BUG ON LINE 168: This function assumes location is always a string,
    but it can also be a dictionary with location details.
    """
    # Format salary range
    salary_range = raw_job.get('salary_range')
    if salary_range and isinstance(salary_range, dict):
        salary_str = f"${salary_range.get('min_salary', 0):,} - ${salary_range.get('max_salary', 0):,} {salary_range.get('currency', 'USD')}"
    else:
        salary_str = salary_range
    
    # Create Job object
    return Job(
        id=raw_job.get('id', raw_job.get('external_id')),
        title=raw_job.get('title', ''),
        company=raw_job.get('company', ''),
        location=raw_job.get('location', ''),  # ⚠️ PROBLEM: Can be a dict!
        description=raw_job.get('description', ''),
        requirements=raw_job.get('requirements', []),
        salary_range=raw_job.get('salary', salary_str),
        job_type=raw_job.get('job_type', 'Full-time'),
        remote=raw_job.get('remote', False) or raw_job.get('location', '').lower() == 'remote',  # ⚠️ BUG HERE!
        #                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        #                                          Calling .lower() on a dict raises AttributeError
        posted_date=raw_job.get('posted_date', raw_job.get('date_posted')),
        apply_url=raw_job.get('url', raw_job.get('apply_url')),
        source=raw_job.get('source', 'unknown')
    )
```

### What Happens

When `raw_job['location']` is a dictionary like:
```python
{
    "city": "San Francisco",
    "state": "CA",
    "country": "US",
    "raw_location": "San Francisco, CA",
    "is_remote": False
}
```

The code `raw_job.get('location', '').lower()` tries to call `.lower()` on the dict, which raises:
```
AttributeError: 'dict' object has no attribute 'lower'
```

This gets wrapped as:
```
HTTPException: Job search failed: 'dict' object has no attribute 'lower'
```

## After: The Fixed Code

```python
def normalize_job_data(raw_job: Dict[str, Any]) -> Job:
    """
    Normalize job data from various sources into our Job model.
    
    FIXED: This function now properly handles location as either a string or dict.
    """
    # Format salary range
    salary_range = raw_job.get('salary_range')
    if salary_range and isinstance(salary_range, dict):
        salary_str = f"${salary_range.get('min_salary', 0):,} - ${salary_range.get('max_salary', 0):,} {salary_range.get('currency', 'USD')}"
    else:
        salary_str = salary_range
    
    # ✅ NEW: Handle location - can be string or dict
    location_data = raw_job.get('location', '')
    if isinstance(location_data, dict):
        # Location is a structured dict - extract relevant fields
        location_str = location_data.get('raw_location') or f"{location_data.get('city', '')}, {location_data.get('state', '')}".strip(', ')
        is_remote = location_data.get('is_remote', False)
    else:
        # Location is a string
        location_str = location_data
        is_remote = location_str.lower() == 'remote' if location_str else False
    
    # Create Job object
    return Job(
        id=raw_job.get('id', raw_job.get('external_id')),
        title=raw_job.get('title', ''),
        company=raw_job.get('company', ''),
        location=location_str,  # ✅ FIXED: Always a string now
        description=raw_job.get('description', ''),
        requirements=raw_job.get('requirements', raw_job.get('skills_required', [])),  # ✅ Also improved
        salary_range=raw_job.get('salary', salary_str),
        job_type=raw_job.get('job_type', 'Full-time'),
        remote=raw_job.get('remote', is_remote),  # ✅ FIXED: Uses properly extracted value
        posted_date=raw_job.get('posted_date', raw_job.get('date_posted')),
        apply_url=raw_job.get('url', raw_job.get('apply_url')),
        source=raw_job.get('source', 'unknown')
    )
```

### What Changed

1. **Type checking**: Added `isinstance(location_data, dict)` to detect the location type
2. **Dict handling**: When location is a dict:
   - Extract `raw_location` field if available
   - Otherwise, construct from `city` and `state`
   - Get `is_remote` flag from the dict
3. **String handling**: When location is a string:
   - Use it directly
   - Check if it equals "remote" (case-insensitive)
4. **Bonus fix**: Also handle `skills_required` as fallback for `requirements`

## Side-by-Side Comparison

| Aspect | Before (Buggy) | After (Fixed) |
|--------|---------------|---------------|
| **Location handling** | Assumes string | Checks type (string or dict) |
| **Remote detection** | `.lower()` on unknown type | Safe extraction based on type |
| **Dict location** | ❌ Crashes with AttributeError | ✅ Extracts `raw_location` or constructs from parts |
| **String location** | ✅ Works | ✅ Still works |
| **Empty location** | ✅ Works | ✅ Still works |
| **Error handling** | None (crashes) | Type-safe with `isinstance()` |

## Test Results

### Input (The Problematic Data)
```python
{
    "id": "mock_job_32",
    "title": "Security Engineer",
    "company": "Microsoft",
    "location": {
        "city": "San Francisco",
        "state": "CA",
        "country": "US",
        "raw_location": "San Francisco, CA",
        "is_remote": False
    }
}
```

### Before Fix
```
❌ AttributeError: 'dict' object has no attribute 'lower'
   HTTP 500 Internal Server Error
```

### After Fix
```
✅ Success! Returns Job object:
{
    "id": "mock_job_32",
    "title": "Security Engineer",
    "company": "Microsoft",
    "location": "San Francisco, CA",  // ✅ Properly extracted string
    "remote": false,                   // ✅ Correctly set
    "requirements": [...],
    ...
}
HTTP 200 OK
```

## Lines Changed

**Total lines changed:** ~15 lines  
**Files modified:** 1 file (`api/routes/jobs.py`)  
**Backward compatible:** ✅ Yes (string locations still work)  
**Breaking changes:** ❌ None

## Key Insights

1. **Never assume data types** - Always validate input types when dealing with external data
2. **Use `isinstance()` checks** - Python's built-in type checking is fast and reliable
3. **Provide fallbacks** - Handle multiple data formats gracefully
4. **Document assumptions** - Comment what types you expect and handle

## Summary

The fix is minimal, focused, and effective:
- **Before:** Assumed location is always a string → crashed on dicts
- **After:** Checks type and handles both strings and dicts → no crashes

This is a textbook example of defensive programming: expect the unexpected and handle it gracefully.
