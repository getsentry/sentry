"""
Tests for job search API
"""
import sys
sys.path.insert(0, '/workspace')

from api.routes.jobs import (
    normalize_job_data,
    search_jobs,
    JobSearchRequest,
    Job
)


def test_normalize_job_data_with_dict_location():
    """Test that normalize_job_data handles dict location correctly"""
    raw_job = {
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
        "description": "Drive product strategy and execution for next-generation platforms.",
        "skills_required": ["Python", "Django", "PostgreSQL"],
        "salary_range": {
            "min_salary": 143654,
            "max_salary": 222129,
            "currency": "USD",
            "period": "annual"
        },
        "employment_type": "permanent",
        "experience_level": "mid"
    }
    
    # This should not raise AttributeError
    job = normalize_job_data(raw_job)
    
    assert isinstance(job, Job)
    assert job.title == "Security Engineer"
    assert job.company == "Microsoft"
    assert job.location == "San Francisco, CA"
    assert job.remote is False
    

def test_normalize_job_data_with_string_location():
    """Test that normalize_job_data handles string location correctly"""
    raw_job = {
        "id": "job_123",
        "title": "Software Engineer",
        "company": "Tech Corp",
        "location": "New York, NY",
        "description": "Great opportunity",
        "requirements": ["Python", "JavaScript"]
    }
    
    job = normalize_job_data(raw_job)
    
    assert isinstance(job, Job)
    assert job.location == "New York, NY"
    assert job.remote is False


def test_normalize_job_data_with_remote_string_location():
    """Test that normalize_job_data detects remote from string location"""
    raw_job = {
        "id": "job_456",
        "title": "Remote Developer",
        "company": "Remote Corp",
        "location": "Remote",
        "description": "Work from anywhere",
        "requirements": ["Python"]
    }
    
    job = normalize_job_data(raw_job)
    
    assert isinstance(job, Job)
    assert job.remote is True


def test_normalize_job_data_with_remote_dict_location():
    """Test that normalize_job_data detects remote from dict location"""
    raw_job = {
        "id": "job_789",
        "title": "Remote Engineer",
        "company": "Global Inc",
        "location": {
            "city": "Anywhere",
            "is_remote": True,
            "raw_location": "Remote"
        },
        "description": "Fully remote position",
        "skills_required": ["Ruby"]
    }
    
    job = normalize_job_data(raw_job)
    
    assert isinstance(job, Job)
    assert job.remote is True


def test_normalize_job_data_with_location_components():
    """Test that normalize_job_data builds location from components"""
    raw_job = {
        "id": "job_101",
        "title": "Data Scientist",
        "company": "Data Co",
        "location": {
            "city": "Boston",
            "state": "MA",
            "country": "US",
            "is_remote": False
        },
        "description": "Analyze data",
        "requirements": ["Python", "R"]
    }
    
    job = normalize_job_data(raw_job)
    
    assert isinstance(job, Job)
    assert job.location == "Boston, MA, US"
    assert job.remote is False


def test_search_jobs():
    """Test job search functionality"""
    request = JobSearchRequest(
        keywords="python",
        location="San Francisco",
        remote=True,
        limit=10
    )
    
    # This should not raise any errors
    response = search_jobs(request)
    
    assert response.total_results > 0
    assert len(response.jobs) > 0
    assert all(isinstance(job, Job) for job in response.jobs)


if __name__ == "__main__":
    # Run tests manually
    print("Running test_normalize_job_data_with_dict_location...")
    test_normalize_job_data_with_dict_location()
    print("✓ Passed")
    
    print("Running test_normalize_job_data_with_string_location...")
    test_normalize_job_data_with_string_location()
    print("✓ Passed")
    
    print("Running test_normalize_job_data_with_remote_string_location...")
    test_normalize_job_data_with_remote_string_location()
    print("✓ Passed")
    
    print("Running test_normalize_job_data_with_remote_dict_location...")
    test_normalize_job_data_with_remote_dict_location()
    print("✓ Passed")
    
    print("Running test_normalize_job_data_with_location_components...")
    test_normalize_job_data_with_location_components()
    print("✓ Passed")
    
    print("Running test_search_jobs...")
    test_search_jobs()
    print("✓ Passed")
    
    print("\nAll tests passed! ✓")
