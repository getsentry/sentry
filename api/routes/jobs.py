"""
Job API routes - CONTAINS BUG TO BE FIXED

The bug is in normalize_job_data where location can be a dict but code
tries to call .lower() on it assuming it's a string.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


# Pydantic models
class JobSearchRequest(BaseModel):
    """Request model for job search"""
    keywords: Optional[str] = None
    location: Optional[str] = None
    experience_level: Optional[str] = None
    job_type: Optional[str] = None
    remote: Optional[bool] = None
    salary_min: Optional[int] = None
    limit: int = 10


class LocationDetail(BaseModel):
    """Location details"""
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    raw_location: Optional[str] = None
    is_remote: Optional[bool] = False


class SalaryRange(BaseModel):
    """Salary range details"""
    min_salary: Optional[int] = None
    max_salary: Optional[int] = None
    currency: Optional[str] = "USD"
    period: Optional[str] = "annual"


class Job(BaseModel):
    """Job model"""
    id: str
    title: str
    company: str
    location: str
    description: str
    requirements: List[str]
    salary_range: Optional[str] = None
    job_type: str
    remote: bool
    posted_date: Optional[str] = None
    apply_url: Optional[str] = None
    source: str


class JobSearchResponse(BaseModel):
    """Response model for job search"""
    query: Optional[str]
    total_results: int
    jobs: List[Job]
    searched_at: Optional[str] = None


def _load_comprehensive_jobs() -> List[Dict[str, Any]]:
    """
    Load comprehensive job data for testing.
    Returns mock job data that matches what might come from an external API.
    """
    return [
        {
            "id": "mock_job_32",
            "external_id": "google_mock_32",
            "title": "Security Engineer",
            "company": "Microsoft",
            "description": "Drive product strategy and execution for next-generation platforms. Work directly with executive leadership and cross-functional teams.",
            "employment_type": "permanent",
            "experience_level": "mid",
            "location": {  # BUG: Location is a dict, not a string!
                "city": "San Francisco",
                "state": "CA",
                "country": "US",
                "raw_location": "San Francisco, CA",
                "is_remote": False
            },
            "salary_range": {
                "min_salary": 143654,
                "max_salary": 222129,
                "currency": "USD",
                "period": "annual"
            },
            "skills_required": [
                "Python",
                "Django",
                "PostgreSQL",
                "AWS",
                "Docker",
                "Kubernetes"
            ]
        },
        {
            "id": "mock_job_33",
            "external_id": "google_mock_33",
            "title": "Senior Backend Engineer",
            "company": "Google",
            "description": "Build scalable backend systems for millions of users.",
            "employment_type": "full-time",
            "experience_level": "senior",
            "location": "Remote",  # This one is a string
            "salary_range": {
                "min_salary": 150000,
                "max_salary": 250000,
                "currency": "USD",
                "period": "annual"
            },
            "skills_required": [
                "Python",
                "Go",
                "Kubernetes"
            ]
        }
    ]


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
    
    # Handle location - can be string or dict
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
        location=location_str,
        description=raw_job.get('description', ''),
        requirements=raw_job.get('requirements', raw_job.get('skills_required', [])),
        salary_range=raw_job.get('salary', salary_str),
        job_type=raw_job.get('job_type', 'Full-time'),
        remote=raw_job.get('remote', is_remote),  # FIXED: Use extracted is_remote value
        posted_date=raw_job.get('posted_date', raw_job.get('date_posted')),
        apply_url=raw_job.get('url', raw_job.get('apply_url')),
        source=raw_job.get('source', 'unknown')
    )


@router.post("/search", response_model=JobSearchResponse)
async def search_jobs(request: JobSearchRequest):
    """
    Search for jobs based on various criteria.
    
    FIXED: This endpoint now properly handles jobs with location as either
    a string or dict thanks to the fix in normalize_job_data.
    """
    try:
        # For now, use mock data
        # In production, this would call external APIs or query database
        results = {
            "status": "success",
            "jobs": _load_comprehensive_jobs()[:request.limit],
            "total_found": len(_load_comprehensive_jobs()),
            "message": "Mock data - showing realistic job results for testing",
            "is_mock": True
        }
        
        job_list = results["jobs"]
        
        if not job_list:
            # Fallback to cached jobs
            job_list = _load_comprehensive_jobs()[:request.limit]
        
        # Normalize results
        jobs = [normalize_job_data(job) for job in job_list]  # <-- BUG TRIGGERED HERE: LINE 216
        
        return JobSearchResponse(
            query=request.keywords,
            total_results=len(jobs),
            jobs=jobs,
            searched_at=datetime.utcnow().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Job search failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Job search failed: {str(e)}")


@router.get("", response_model=JobSearchResponse)
async def get_jobs(
    keywords: Optional[str] = None,
    location: Optional[str] = None,
    limit: int = 10
):
    """
    Get jobs (GET endpoint for backward compatibility).
    """
    request = JobSearchRequest(
        keywords=keywords,
        location=location,
        limit=limit
    )
    return await search_jobs(request)


@router.post("/match", response_model=Dict[str, Any])
async def match_jobs(request: Dict[str, Any]):
    """
    Match jobs to resume using AI.
    Placeholder endpoint for future implementation.
    """
    return {
        "message": "Job matching not yet implemented",
        "status": "pending"
    }
