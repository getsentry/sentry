# FastAPI Route Ordering Fix

## Problem

The original issue was caused by incorrect route registration order in FastAPI. When a parameterized route like `/{job_id}` is registered before a specific route like `/search`, FastAPI's router matches the literal path segment "search" to the parameter, causing the wrong endpoint to be called.

### Original Bug Behavior

```
GET /api/v1/jobs/search?query=python
```

This request was incorrectly matched to:
- Route: `/{job_id}`
- Parameter: `job_id = "search"`
- Result: HTTPException 501 "not yet implemented"

## Root Cause

**Incorrect route order:**
```python
# WRONG - This causes the bug
@router.get("/{job_id}")  # Registered first
async def get_job(job_id: str):
    ...

@router.get("/search")  # Registered second
async def search_jobs(...):
    ...
```

When routes are registered in this order, FastAPI's router checks the parameterized route first and matches `/search` as a valid value for `{job_id}`.

## Solution

**Correct route order - specific routes before parameterized routes:**

```python
# CORRECT - This fixes the bug
@router.get("/search")  # Registered first
async def search_jobs(...):
    ...

@router.get("/{job_id}")  # Registered second
async def get_job(job_id: str):
    ...
```

## Key Principles

### 1. Route Registration Order Matters
FastAPI matches routes in the order they are registered. The first matching route will handle the request.

### 2. Specificity First
Always register more specific routes before more general/parameterized routes:
- ✓ `/search` before `/{job_id}`
- ✓ `/admin/stats` before `/admin/{id}`
- ✓ `/users/me` before `/users/{user_id}`

### 3. Common Patterns

```python
# Good pattern
@router.get("/special-action")  # Specific literal
@router.get("/{id}/details")     # Specific path structure
@router.get("/{id}")             # General parameterized

# Bad pattern
@router.get("/{id}")             # Will match everything!
@router.get("/special-action")   # Never reached
```

## Testing

The fix includes comprehensive tests to verify:

1. `/search` endpoint returns search results (not 501 error)
2. `/{job_id}` endpoint works for actual job IDs
3. Routes are registered in the correct order
4. The literal path "search" is not interpreted as a job_id parameter

Run tests with:
```bash
pytest api/routes/test_jobs.py -v
```

Or use the standalone verification script:
```bash
python api/verify_fix.py
```

## Files Changed

- `api/routes/jobs.py` - Fixed route ordering
- `api/routes/test_jobs.py` - Comprehensive tests
- `api/verify_fix.py` - Standalone verification
- `api/main.py` - Example FastAPI app

## Implementation Details

The fixed `jobs.py` file now has:

1. **Search endpoint first** (line ~15):
   ```python
   @router.get("/search")
   async def search_jobs(query, location, remote):
       # Returns search results with job listings
   ```

2. **Parameterized endpoint second** (line ~45):
   ```python
   @router.get("/{job_id}")
   async def get_job(job_id: str):
       # Returns single job details or 404
   ```

3. **Clear documentation** explaining why order matters

## Verification

After applying this fix:

✓ `GET /api/v1/jobs/search?query=python` → Returns search results (200)
✓ `GET /api/v1/jobs/job-123` → Returns job details (200)
✓ `GET /api/v1/jobs/nonexistent` → Returns 404 (not 501)

## Additional Resources

- [FastAPI Path Operations Order](https://fastapi.tiangolo.com/tutorial/path-params/#order-matters)
- [FastAPI Router Documentation](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

## Summary

**The fix is simple but critical:** Register specific routes before parameterized routes. This ensures FastAPI's router correctly matches literal path segments to their intended endpoints rather than treating them as parameter values.
