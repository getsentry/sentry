"""
Job API routes with corrected route ordering.

IMPORTANT: Specific routes (like /search) must be registered BEFORE
parameterized routes (like /{job_id}) to prevent routing conflicts.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


# FIXED: Specific route /search is registered BEFORE the parameterized /{job_id} route
@router.get("/search")
async def search_jobs(
    query: Optional[str] = Query(None, description="Search query for jobs"),
    location: Optional[str] = Query(None, description="Job location"),
    remote: Optional[bool] = Query(None, description="Remote jobs only"),
):
    """
    Search for jobs based on various criteria.
    
    This route must be defined before /{job_id} to ensure /search
    is not interpreted as a job_id parameter.
    """
    # Implement actual job search logic here
    results = []
    
    # Example search logic (replace with actual database query)
    if query:
        # Search by query
        results.append({
            "id": "job-123",
            "title": f"Software Engineer - {query}",
            "location": location or "Remote",
            "remote": remote if remote is not None else True,
            "description": f"Looking for someone with {query} skills"
        })
    
    return {
        "query": query,
        "location": location,
        "remote": remote,
        "total": len(results),
        "jobs": results
    }


# Parameterized route comes AFTER specific routes
@router.get("/{job_id}")
async def get_job(job_id: str):
    """
    Get details for a specific job by ID.
    
    This route is registered after /search to prevent routing conflicts.
    """
    # Implement actual job lookup logic here
    # For now, return a sample job or 404 if not found
    
    # Example implementation (replace with actual database lookup)
    if job_id == "job-123":
        return {
            "id": job_id,
            "title": "Senior Software Engineer",
            "location": "San Francisco, CA",
            "remote": True,
            "description": "Exciting opportunity at a fast-growing startup",
            "requirements": ["Python", "FastAPI", "PostgreSQL"],
            "salary_range": {"min": 120000, "max": 180000}
        }
    
    raise HTTPException(
        status_code=404,
        detail=f"Job with id '{job_id}' not found"
    )


# Additional job-related endpoints can be added here
@router.post("/")
async def create_job(job_data: dict):
    """Create a new job posting."""
    # Implementation here
    return {"message": "Job created", "id": "new-job-id"}


@router.put("/{job_id}")
async def update_job(job_id: str, job_data: dict):
    """Update an existing job posting."""
    # Implementation here
    return {"message": f"Job {job_id} updated"}


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job posting."""
    # Implementation here
    return {"message": f"Job {job_id} deleted"}
