# Route Ordering Fix: Before vs After

## The Problem

FastAPI was matching `/api/v1/jobs/search` to the wrong endpoint, causing a 501 error instead of returning search results.

---

## BEFORE (Broken) ❌

### Route Definition Order
```python
# api/routes/jobs.py (BROKEN VERSION)

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/jobs")

# Route 1: Parameterized route (TOO GENERAL, REGISTERED FIRST)
@router.get("/{job_id}")  # ❌ Registered first
async def get_job(job_id: str):
    raise HTTPException(
        status_code=501,
        detail="Job detail lookup not yet implemented - use /jobs/search instead"
    )

# Route 2: Specific route (NEVER REACHED)
@router.get("/search")  # ❌ Registered second
async def search_jobs(query: str = None):
    return {"query": query, "jobs": [...]}
```

### What Happens
```
Request:  GET /api/v1/jobs/search?query=python

FastAPI Router Logic:
  1. Check route /{job_id}
     - Does "search" match {job_id}? ✓ YES (any string matches)
     - Match found! job_id = "search"
     - Call get_job("search")
     
  2. Never checks /search route (already matched)

Result:   HTTPException 501
          "Job detail lookup not yet implemented - use /jobs/search instead"

Status:   ❌ BROKEN - User tried to use /search but hit wrong endpoint
```

---

## AFTER (Fixed) ✅

### Route Definition Order
```python
# api/routes/jobs.py (FIXED VERSION)

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/jobs")

# Route 1: Specific route (REGISTERED FIRST)
@router.get("/search")  # ✅ Registered first
async def search_jobs(query: str = None, location: str = None, remote: bool = None):
    """Search endpoint - matches literal path /search"""
    results = [...]  # Actual search logic
    return {
        "query": query,
        "location": location,
        "remote": remote,
        "total": len(results),
        "jobs": results
    }

# Route 2: Parameterized route (REGISTERED SECOND)
@router.get("/{job_id}")  # ✅ Registered second
async def get_job(job_id: str):
    """Job detail endpoint - matches any other path"""
    # Actual database lookup
    job = find_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return job
```

### What Happens
```
Request:  GET /api/v1/jobs/search?query=python

FastAPI Router Logic:
  1. Check route /search
     - Does "search" match literal "/search"? ✓ YES (exact match)
     - Match found!
     - Call search_jobs(query="python")
     
  2. Never checks /{job_id} route (already matched)

Result:   {
            "query": "python",
            "location": null,
            "remote": null,
            "total": 1,
            "jobs": [...]
          }

Status:   ✅ WORKING - Search endpoint correctly handles the request
```

---

## Key Differences

| Aspect | Before (Broken) | After (Fixed) |
|--------|----------------|---------------|
| `/search` registration | Second | **First** |
| `/{job_id}` registration | First | **Second** |
| `/search` request handling | Incorrectly matched to `/{job_id}` | ✅ Correctly matched to `/search` |
| Error on `/search` | 501 Not Implemented | ✅ 200 OK with results |
| `/job-123` request handling | Would work (if implemented) | ✅ Works correctly |

---

## Testing Both Scenarios

### Test Case 1: Search Request
```bash
# Request
GET /api/v1/jobs/search?query=python&location=San%20Francisco&remote=true

# Before (Broken)
Response: 501 Not Implemented
Body: {"detail": "Job detail lookup not yet implemented - use /jobs/search instead"}

# After (Fixed)  
Response: 200 OK
Body: {"query": "python", "location": "San Francisco", "remote": true, "jobs": [...]}
```

### Test Case 2: Job Detail Request
```bash
# Request
GET /api/v1/jobs/job-123

# Before (Broken)
Response: 501 Not Implemented
Body: {"detail": "Job detail lookup not yet implemented - use /jobs/search instead"}

# After (Fixed)
Response: 200 OK (if exists) or 404 Not Found
Body: {"id": "job-123", "title": "...", "location": "...", ...}
```

---

## Why Order Matters in FastAPI

FastAPI's router uses a **first-match** strategy:

1. **Routes are checked in registration order**
2. **First matching route handles the request**
3. **No further routes are checked after a match**

This means:
- ✅ Specific routes (literal paths) should be registered first
- ✅ General routes (with parameters) should be registered last
- ❌ Never put `/{param}` before specific paths like `/search`

### Route Specificity Ranking
```
Most Specific (register first):
  ✓ /users/me
  ✓ /users/admin
  ✓ /users/search
  
  ↓ (decreasing specificity)
  
Least Specific (register last):
  ✓ /users/{user_id}/settings
  ✓ /users/{user_id}
```

---

## The Fix Applied

The fix in `api/routes/jobs.py` ensures:

1. ✅ `/search` endpoint is defined **before** `/{job_id}`
2. ✅ Search requests correctly return results (200 OK)
3. ✅ Job detail requests work with actual job IDs
4. ✅ Proper error handling (404 for not found, not 501)

**Result:** The original bug is completely resolved. The `/search` endpoint now works as intended.
