"""
Jobs API routes for listing and searching job postings.
"""
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class JobData:
    """Normalized job data structure."""
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


def _extract_location_string(location_data: Any) -> str:
    """
    Extract a string representation from location data.
    
    Handles both legacy string format and new dictionary format.
    
    Args:
        location_data: Either a string or a dictionary with location information
        
    Returns:
        A string representation of the location
    """
    if isinstance(location_data, str):
        return location_data
    elif isinstance(location_data, dict):
        # Prefer raw_location, then city, then construct from available fields
        if 'raw_location' in location_data and location_data['raw_location']:
            return location_data['raw_location']
        elif 'city' in location_data and location_data['city']:
            return location_data['city']
        else:
            # Construct from available fields
            parts = []
            if location_data.get('city'):
                parts.append(location_data['city'])
            if location_data.get('state'):
                parts.append(location_data['state'])
            if location_data.get('country'):
                parts.append(location_data['country'])
            return ', '.join(parts) if parts else 'Unknown'
    else:
        return ''


def _is_remote_location(location_data: Any) -> bool:
    """
    Determine if a location represents a remote position.
    
    Handles both legacy string format and new dictionary format.
    
    Args:
        location_data: Either a string or a dictionary with location information
        
    Returns:
        True if the location indicates a remote position
    """
    if isinstance(location_data, dict):
        # Check the is_remote field if it exists
        if 'is_remote' in location_data:
            return bool(location_data['is_remote'])
        # Fall back to checking the raw_location or city for 'remote' keyword
        location_str = _extract_location_string(location_data)
        return 'remote' in location_str.lower()
    elif isinstance(location_data, str):
        return 'remote' in location_data.lower()
    else:
        return False


def normalize_job_data(raw_job: Dict[str, Any]) -> JobData:
    """
    Normalize raw job data from various sources into a consistent format.
    
    Args:
        raw_job: Raw job dictionary from external source
        
    Returns:
        JobData object with normalized fields
    """
    # Extract location data (handles both string and dict formats)
    location_data = raw_job.get('location', '')
    location_str = _extract_location_string(location_data)
    
    # Determine if job is remote
    # Check explicit 'remote' field first, then location data
    is_remote = raw_job.get('remote', False) or _is_remote_location(location_data)
    
    # Extract requirements/skills
    requirements = raw_job.get('requirements', [])
    if not requirements and 'skills_required' in raw_job:
        requirements = raw_job.get('skills_required', [])
    
    # Determine job type
    job_type = raw_job.get('job_type', '')
    if not job_type and 'employment_type' in raw_job:
        employment_type = raw_job.get('employment_type', '')
        # Map employment_type to job_type
        type_mapping = {
            'full_time': 'Full-time',
            'part_time': 'Part-time',
            'contract': 'Contract',
            'permanent': 'Permanent',
            'temporary': 'Temporary',
        }
        job_type = type_mapping.get(employment_type, 'Full-time')
    else:
        job_type = job_type or 'Full-time'
    
    return JobData(
        id=raw_job.get('id', raw_job.get('external_id', '')),
        title=raw_job.get('title', ''),
        company=raw_job.get('company', ''),
        location=location_str,
        description=raw_job.get('description', ''),
        requirements=requirements,
        salary_range=raw_job.get('salary', raw_job.get('salary_range')),
        job_type=job_type,
        remote=is_remote,
        posted_date=raw_job.get('posted_date', raw_job.get('date_posted')),
        apply_url=raw_job.get('url', raw_job.get('apply_url')),
        source=raw_job.get('source', 'unknown')
    )


def _load_comprehensive_jobs() -> List[Dict[str, Any]]:
    """
    Load comprehensive job listings from cache or data source.
    
    Returns:
        List of raw job dictionaries
    """
    # This would typically load from a cache or database
    # For now, return mock data for testing
    return [
        {
            "company": 'Salesforce',
            "description": 'Drive product strategy and execution for next-generation platforms. Work directly with executive leadership and cross-functional teams.',
            "employment_type": 'full_time',
            "experience_level": 'principal',
            "external_id": 'google_mock_2',
            "id": 'mock_job_2',
            "location": {
                "city": 'Remote',
                "country": 'US',
                "is_remote": True,
                "raw_location": 'Remote',
                "state": None
            },
            "salary_range": {
                "currency": 'USD',
                "max_salary": 258659,
                "min_salary": 228549,
                "period": 'annual'
            },
            "skills_required": [
                'Go',
                'gRPC',
                'Terraform',
                'GCP',
                'Prometheus'
            ],
            "title": 'Staff Engineer'
        },
        {
            "company": 'Palantir',
            "description": 'Build scalable systems that serve millions of users worldwide. Work with cutting-edge technologies and collaborate with world-class engineers.',
            "employment_type": 'full_time',
            "experience_level": 'principal',
            "external_id": 'google_mock_10',
            "id": 'mock_job_10',
            "location": {
                "city": 'Remote (US)',
                "country": 'US',
                "is_remote": True,
                "raw_location": 'Remote (US)',
                "state": None
            },
            "salary_range": {
                "currency": 'USD',
                "max_salary": 207322,
                "min_salary": 141901,
                "period": 'annual'
            },
            "skills_required": [
                'Machine Learning',
                'TensorFlow',
                'PyTorch',
                'Pandas',
                'SQL'
            ],
            "title": 'Senior Software Engineer'
        }
    ]


def list_jobs(keywords: Optional[str] = None, location: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    """
    List jobs based on search criteria.
    
    Args:
        keywords: Search keywords for job title/description
        location: Location filter
        limit: Maximum number of jobs to return
        
    Returns:
        List of normalized job dictionaries
    """
    if not keywords:
        logger.debug("No keywords provided, returning top jobs from cache")
        job_list = _load_comprehensive_jobs()
    else:
        # In a real implementation, this would filter based on keywords
        job_list = _load_comprehensive_jobs()
    
    # Normalize jobs
    try:
        jobs = [normalize_job_data(job) for job in job_list[:limit]]
        logger.info(f"Returning {len(jobs)} jobs for keywords: {keywords}")
        # Convert JobData objects to dictionaries for API response
        return [
            {
                'id': job.id,
                'title': job.title,
                'company': job.company,
                'location': job.location,
                'description': job.description,
                'requirements': job.requirements,
                'salary_range': job.salary_range,
                'job_type': job.job_type,
                'remote': job.remote,
                'posted_date': job.posted_date,
                'apply_url': job.apply_url,
                'source': job.source,
            }
            for job in jobs
        ]
    except Exception as e:
        logger.error(f"Error normalizing jobs: {e}", exc_info=True)
        return []


def search_jobs(criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Search for jobs based on complex criteria.
    
    Args:
        criteria: Dictionary containing search criteria
        
    Returns:
        List of matching job dictionaries
    """
    keywords = criteria.get('keywords')
    location = criteria.get('location')
    limit = criteria.get('limit', 10)
    
    return list_jobs(keywords=keywords, location=location, limit=limit)
