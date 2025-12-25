# Visual Route Matching Flow

## Before Fix (Broken) ❌

```
User Request: GET /api/v1/jobs/search?query=python
                           │
                           ▼
              ┌─────────────────────────┐
              │  FastAPI Router         │
              │  (checks routes in      │
              │   registration order)   │
              └─────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ Route 1: /{job_id}      │ ◄─── Registered FIRST
              │ Pattern: any string     │
              └─────────────────────────┘
                           │
                    [MATCH FOUND!]
                           │
                  job_id = "search"
                           │
                           ▼
              ┌─────────────────────────┐
              │  get_job("search")      │
              │                         │
              │  raise HTTPException(   │
              │    status_code=501,     │
              │    detail="not impl"    │
              │  )                      │
              └─────────────────────────┘
                           │
                           ▼
                  ❌ 501 ERROR
              "not yet implemented"


Route 2: /search (never checked!) ☠️
```

---

## After Fix (Working) ✅

```
User Request: GET /api/v1/jobs/search?query=python
                           │
                           ▼
              ┌─────────────────────────┐
              │  FastAPI Router         │
              │  (checks routes in      │
              │   registration order)   │
              └─────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ Route 1: /search        │ ◄─── Registered FIRST
              │ Pattern: literal match  │
              └─────────────────────────┘
                           │
                    [MATCH FOUND!]
                           │
                           ▼
              ┌─────────────────────────┐
              │  search_jobs(           │
              │    query="python"       │
              │  )                      │
              │                         │
              │  return {               │
              │    "query": "python",   │
              │    "jobs": [...]        │
              │  }                      │
              └─────────────────────────┘
                           │
                           ▼
                  ✅ 200 OK
            { search results }


Route 2: /{job_id} (not needed, already matched) ⏭️
```

---

## Side-by-Side Comparison

### Request Flow

| Step | Before (Broken) | After (Fixed) |
|------|----------------|---------------|
| 1️⃣ Request arrives | `/search` | `/search` |
| 2️⃣ First route checked | `/{job_id}` matches! ❌ | `/search` matches! ✅ |
| 3️⃣ Function called | `get_job("search")` ❌ | `search_jobs(...)` ✅ |
| 4️⃣ Result | 501 Error ❌ | 200 OK ✅ |

---

## Route Registration Order

### Before (Broken)
```
┌─────────────────────────────────────────────┐
│  Route Registration Order (WRONG)           │
├─────────────────────────────────────────────┤
│  1. @router.get("/{job_id}")        ⚠️      │
│     - Registered first                      │
│     - Matches ANY string                    │
│     - Will match "search" ❌                │
│                                             │
│  2. @router.get("/search")          ☠️      │
│     - Registered second                     │
│     - Never reached!                        │
│     - Dead code                             │
└─────────────────────────────────────────────┘
```

### After (Fixed)
```
┌─────────────────────────────────────────────┐
│  Route Registration Order (CORRECT)         │
├─────────────────────────────────────────────┤
│  1. @router.get("/search")          ✅      │
│     - Registered first                      │
│     - Matches literal "search"              │
│     - Takes priority!                       │
│                                             │
│  2. @router.get("/{job_id}")        ✅      │
│     - Registered second                     │
│     - Matches other strings                 │
│     - Fallback for actual job IDs           │
└─────────────────────────────────────────────┘
```

---

## How Different Paths Are Matched

### After Fix (Correct Behavior)

```
GET /api/v1/jobs/search
    └─→ Checks /search first → MATCH! ✅
        └─→ Calls search_jobs()

GET /api/v1/jobs/job-123
    └─→ Checks /search first → no match
        └─→ Checks /{job_id} next → MATCH! ✅
            └─→ Calls get_job("job-123")

GET /api/v1/jobs/xyz-789
    └─→ Checks /search first → no match
        └─→ Checks /{job_id} next → MATCH! ✅
            └─→ Calls get_job("xyz-789")
```

### Before Fix (Broken Behavior)

```
GET /api/v1/jobs/search
    └─→ Checks /{job_id} first → MATCH! ❌ (wrong!)
        └─→ Calls get_job("search") → 501 Error

GET /api/v1/jobs/job-123
    └─→ Checks /{job_id} first → MATCH! ✅
        └─→ Calls get_job("job-123") → 501 Error

Everything goes to /{job_id}! ❌
```

---

## The Fix in Code

```python
# BEFORE (BROKEN)
@router.get("/{job_id}")    # ❌ TOO EARLY!
async def get_job(job_id: str):
    raise HTTPException(501, "not implemented")

@router.get("/search")      # ❌ TOO LATE! Never reached
async def search_jobs(...):
    return {"jobs": [...]}


# AFTER (FIXED)
@router.get("/search")      # ✅ FIRST! Specific route
async def search_jobs(...):
    return {"jobs": [...]}

@router.get("/{job_id}")    # ✅ SECOND! General route
async def get_job(job_id: str):
    return find_job(job_id) or raise_404()
```

---

## Key Insight

FastAPI uses **first-match routing**:
- Routes are checked in **registration order**
- The **first matching** route handles the request
- **No backtracking** - once matched, other routes are ignored

Therefore:
- **Specific** routes (literal paths) must come **first**
- **General** routes (with parameters) must come **last**

```
Priority Order:
  🥇 /search          (most specific - literal)
  🥈 /{id}/details    (medium - partial literal)
  🥉 /{id}            (least specific - all parameter)
```

---

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| 501 error on `/search` | Wrong route order | Reorder routes |
| `search` treated as `job_id` | Parameter matched first | Literal path first |
| Dead `/search` endpoint | Never reached | Move before `/{job_id}` |

**One simple change fixes everything: Move `/search` before `/{job_id}` ✅**
