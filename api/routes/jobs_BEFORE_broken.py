"""
BEFORE (Incorrect - causes the bug):
Route registration order causes /search to be matched as {job_id}
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/jobs")


# ❌ WRONG: Parameterized route registered FIRST
@router.get("/{job_id}")
async def get_job(job_id: str):
    """
    This route is checked first by FastAPI router.
    When request is GET /api/v1/jobs/search, the router matches it here
    with job_id='search' instead of checking for more specific routes.
    """
    try:
        # This placeholder was in the original code
        raise HTTPException(
            status_code=501,
            detail="Job detail lookup not yet implemented - use /jobs/search instead"
        )
    except HTTPException:
        raise


# This route is never reached when path is /search
@router.get("/search")
async def search_jobs(query: str = None):
    """
    This route is registered AFTER the parameterized route.
    FastAPI never gets here when the path is /search because
    it already matched the path to /{job_id} above.
    """
    return {"query": query, "jobs": []}


"""
RESULT WITH INCORRECT ORDER:
    GET /api/v1/jobs/search?query=python
    
    FastAPI's routing logic:
    1. Check route: /{job_id}
    2. Does "search" match the pattern /{job_id}? YES
    3. Set job_id = "search"
    4. Call get_job("search")
    5. Raise HTTPException 501
    
    The /search route is NEVER CHECKED because a match was already found.
"""
