"""
Job search API routes
"""
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
import json
from pathlib import Path


@dataclass
class JobSearchRequest:
    """Request model for job search"""
    keywords: str
    location: Optional[str] = None
    experience_level: Optional[str] = None
    job_type: Optional[str] = None
    remote: bool = False
    salary_min: Optional[int] = None
    limit: int = 10


@dataclass
class Job:
    """Job model"""
    id: str
    title: str
    company: str
    location: str
    description: str
    requirements: List[str]
    salary_range: Optional[Dict[str, Any]]
    job_type: str
    remote: bool
    posted_date: Optional[str]
    apply_url: Optional[str]
    source: str


@dataclass
class JobSearchResponse:
    """Response model for job search"""
    query: str
    total_results: int
    jobs: List[Job]
    message: Optional[str] = None


def _load_comprehensive_jobs() -> List[Dict[str, Any]]:
    """Load mock job data for testing"""
    return [
        {
            "id": "mock_job_32",
            "external_id": "google_mock_32",
            "title": "Security Engineer",
            "company": "Microsoft",
            "location": {
                "city": "San Francisco",
                "state": "CA",
                "country": "US",
                "raw_location": "San Francisco, CA",
                "is_remote": False
            },
            "description": "Drive product strategy and execution for next-generation platforms. Work directly with executive leadership and cross-functional teams.",
            "skills_required": ["Python", "Django", "PostgreSQL", "AWS", "Docker", "Kubernetes"],
            "salary_range": {
                "min_salary": 143654,
                "max_salary": 222129,
                "currency": "USD",
                "period": "annual"
            },
            "employment_type": "permanent",
            "experience_level": "mid"
        }
    ]


def normalize_job_data(raw_job: Dict[str, Any]) -> Job:
    """
    Normalize job data from various sources into a consistent format.
    
    Args:
        raw_job: Raw job data from external source
        
    Returns:
        Normalized Job object
    """
    # Handle location field - can be string or dict
    location_value = raw_job.get('location', '')
    
    # Determine if job is remote
    remote = raw_job.get('remote', False)
    
    # Check location for remote status
    if isinstance(location_value, dict):
        # Location is a dictionary with structured data
        location_str = location_value.get('raw_location', '')
        if not location_str:
            # Build location string from components
            parts = []
            if location_value.get('city'):
                parts.append(location_value['city'])
            if location_value.get('state'):
                parts.append(location_value['state'])
            if location_value.get('country'):
                parts.append(location_value['country'])
            location_str = ', '.join(parts) if parts else 'Unknown'
        
        # Check is_remote flag in location dict
        if location_value.get('is_remote'):
            remote = True
    elif isinstance(location_value, str):
        # Location is a string
        location_str = location_value
        # Check if location string indicates remote
        if location_str.lower() == 'remote':
            remote = True
    else:
        # Fallback for unexpected types
        location_str = str(location_value) if location_value else 'Unknown'
    
    # Normalize requirements/skills
    requirements = raw_job.get('requirements', [])
    if not requirements:
        requirements = raw_job.get('skills_required', [])
    
    # Normalize salary
    salary_range = raw_job.get('salary', raw_job.get('salary_range'))
    
    # Normalize job type
    job_type = raw_job.get('job_type', raw_job.get('employment_type', 'Full-time'))
    
    return Job(
        id=raw_job.get('id', raw_job.get('external_id', '')),
        title=raw_job.get('title', ''),
        company=raw_job.get('company', ''),
        location=location_str,
        description=raw_job.get('description', ''),
        requirements=requirements,
        salary_range=salary_range,
        job_type=job_type,
        remote=remote,
        posted_date=raw_job.get('posted_date', raw_job.get('date_posted')),
        apply_url=raw_job.get('url', raw_job.get('apply_url')),
        source=raw_job.get('source', 'unknown')
    )


def search_jobs(request: JobSearchRequest) -> JobSearchResponse:
    """
    Search for jobs based on criteria.
    
    Args:
        request: Job search request parameters
        
    Returns:
        JobSearchResponse with matching jobs
        
    Raises:
        HTTPException: If search fails
    """
    try:
        # For this example, we'll use the mock data
        # In production, this would call external APIs or database
        job_list = _load_comprehensive_jobs()[:request.limit]
        
        # Normalize results
        jobs = [normalize_job_data(job) for job in job_list]
        
        return JobSearchResponse(
            query=request.keywords,
            total_results=len(jobs),
            jobs=jobs,
            message="Mock data - showing realistic job results for testing"
        )
    except Exception as e:
        # Log the error and re-raise
        print(f"Job search failed: {str(e)}")
        raise
