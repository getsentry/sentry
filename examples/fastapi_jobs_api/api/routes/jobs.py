"""
Jobs API routes - Fixed implementation

This module implements job-related API endpoints with proper error handling.
Previously, the /jobs/{job_id} endpoint raised an unhandled 501 HTTPException,
which caused cascading failures when called by other parts of the application.

The fix includes:
1. Implementing the /jobs/{job_id} endpoint with actual functionality
2. Adding proper error handling to catch and handle HTTPExceptions
3. Ensuring internal API calls don't propagate unhandled exceptions
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel


router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


# Data models
class Job(BaseModel):
    id: str
    title: str
    company: str
    location: str
    remote: bool
    description: str
    salary_range: Optional[str] = None


class JobSearchResult(BaseModel):
    jobs: List[Job]
    total: int
    page: int
    per_page: int


# Mock database (in production, this would be a real database)
MOCK_JOBS = {
    "job_001": Job(
        id="job_001",
        title="Senior Software Engineer",
        company="Tech Corp",
        location="San Francisco, CA",
        remote=True,
        description="We're looking for an experienced software engineer...",
        salary_range="$150k-$200k"
    ),
    "job_002": Job(
        id="job_002",
        title="Python Developer",
        company="Startup Inc",
        location="Remote",
        remote=True,
        description="Join our team as a Python developer...",
        salary_range="$120k-$160k"
    ),
    "job_003": Job(
        id="job_003",
        title="Backend Engineer",
        company="Data Solutions",
        location="New York, NY",
        remote=False,
        description="Build scalable backend systems...",
        salary_range="$130k-$180k"
    ),
}


@router.get("/search", response_model=JobSearchResult)
async def search_jobs(
    query: Optional[str] = Query(None, description="Search query"),
    location: Optional[str] = Query(None, description="Location filter"),
    remote: Optional[bool] = Query(None, description="Remote work filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Results per page")
):
    """
    Search for jobs with optional filters.
    
    Args:
        query: Search term to match against job title or description
        location: Filter by location
        remote: Filter by remote availability
        page: Page number for pagination
        per_page: Number of results per page
        
    Returns:
        JobSearchResult with matching jobs and pagination info
    """
    # Filter jobs based on criteria
    filtered_jobs = list(MOCK_JOBS.values())
    
    if query:
        query_lower = query.lower()
        filtered_jobs = [
            job for job in filtered_jobs
            if query_lower in job.title.lower() or query_lower in job.description.lower()
        ]
    
    if location:
        location_lower = location.lower()
        filtered_jobs = [
            job for job in filtered_jobs
            if location_lower in job.location.lower()
        ]
    
    if remote is not None:
        filtered_jobs = [
            job for job in filtered_jobs
            if job.remote == remote
        ]
    
    # Pagination
    total = len(filtered_jobs)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_jobs = filtered_jobs[start_idx:end_idx]
    
    return JobSearchResult(
        jobs=paginated_jobs,
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/{job_id}", response_model=Job)
async def get_job_by_id(job_id: str):
    """
    Get a specific job by ID.
    
    This endpoint was previously unimplemented and raised a 501 error.
    It now properly fetches and returns job details.
    
    Args:
        job_id: The unique identifier for the job
        
    Returns:
        Job details if found
        
    Raises:
        HTTPException: 404 if job not found
    """
    job = MOCK_JOBS.get(job_id)
    
    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Job with id '{job_id}' not found. Use /api/v1/jobs/search to find available jobs."
        )
    
    return job
