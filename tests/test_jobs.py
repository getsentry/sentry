"""
Tests for the jobs API routes.
"""
import sys
import os

# Add the parent directory to the path so we can import the api module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.routes.jobs import normalize_job_data, list_jobs, search_jobs


def test_normalize_job_with_dict_location():
    """Test that normalize_job_data handles dictionary location format."""
    raw_job = {
        "company": 'Salesforce',
        "description": 'Drive product strategy and execution.',
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
        ],
        "title": 'Staff Engineer'
    }
    
    # This should not raise AttributeError
    result = normalize_job_data(raw_job)
    
    assert result.id == 'mock_job_2'
    assert result.title == 'Staff Engineer'
    assert result.company == 'Salesforce'
    assert result.location == 'Remote'  # Should extract the location string
    assert result.remote is True  # Should recognize as remote
    assert result.job_type == 'Full-time'
    assert result.requirements == ['Go', 'gRPC', 'Terraform']
    print("✓ test_normalize_job_with_dict_location passed")


def test_normalize_job_with_string_location():
    """Test that normalize_job_data still handles string location format."""
    raw_job = {
        "id": 'test_job_1',
        "title": 'Senior Developer',
        "company": 'TechCorp',
        "location": 'San Francisco, CA',
        "description": 'Build great software',
        "job_type": 'Full-time',
        "remote": False,
    }
    
    result = normalize_job_data(raw_job)
    
    assert result.location == 'San Francisco, CA'
    assert result.remote is False
    print("✓ test_normalize_job_with_string_location passed")


def test_normalize_job_with_string_location_remote():
    """Test that normalize_job_data detects remote from string location."""
    raw_job = {
        "id": 'test_job_2',
        "title": 'Senior Developer',
        "company": 'TechCorp',
        "location": 'Remote',
        "description": 'Build great software',
    }
    
    result = normalize_job_data(raw_job)
    
    assert result.location == 'Remote'
    assert result.remote is True  # Should detect 'remote' in location string
    print("✓ test_normalize_job_with_string_location_remote passed")


def test_normalize_job_with_dict_location_not_remote():
    """Test dictionary location format for non-remote jobs."""
    raw_job = {
        "id": 'test_job_3',
        "title": 'Software Engineer',
        "company": 'LocalCorp',
        "location": {
            "city": 'New York',
            "state": 'NY',
            "country": 'US',
            "is_remote": False,
            "raw_location": 'New York, NY'
        },
        "description": 'On-site position',
    }
    
    result = normalize_job_data(raw_job)
    
    assert result.location == 'New York, NY'
    assert result.remote is False
    print("✓ test_normalize_job_with_dict_location_not_remote passed")


def test_normalize_job_with_dict_location_missing_raw_location():
    """Test dictionary location format without raw_location field."""
    raw_job = {
        "id": 'test_job_4',
        "title": 'Developer',
        "company": 'StartupCo',
        "location": {
            "city": 'Austin',
            "state": 'TX',
            "country": 'US',
            "is_remote": False
        },
        "description": 'Great opportunity',
    }
    
    result = normalize_job_data(raw_job)
    
    # Should construct location from city
    assert result.location == 'Austin'
    assert result.remote is False
    print("✓ test_normalize_job_with_dict_location_missing_raw_location passed")


def test_list_jobs():
    """Test that list_jobs successfully returns normalized jobs."""
    jobs = list_jobs(keywords='engineer', limit=5)
    
    assert isinstance(jobs, list)
    assert len(jobs) > 0
    
    # Verify first job has expected fields and is properly normalized
    first_job = jobs[0]
    assert 'id' in first_job
    assert 'title' in first_job
    assert 'company' in first_job
    assert 'location' in first_job
    assert 'remote' in first_job
    
    # Location should be a string, not a dict
    assert isinstance(first_job['location'], str)
    
    # Remote should be a boolean
    assert isinstance(first_job['remote'], bool)
    
    print(f"✓ test_list_jobs passed - returned {len(jobs)} jobs")


def test_search_jobs():
    """Test that search_jobs successfully returns results."""
    criteria = {
        'keywords': 'python',
        'location': 'remote',
        'limit': 10
    }
    
    jobs = search_jobs(criteria)
    
    assert isinstance(jobs, list)
    print(f"✓ test_search_jobs passed - returned {len(jobs)} jobs")


def test_list_jobs_no_keywords():
    """Test that list_jobs works without keywords."""
    jobs = list_jobs(limit=10)
    
    assert isinstance(jobs, list)
    print(f"✓ test_list_jobs_no_keywords passed - returned {len(jobs)} jobs")


if __name__ == '__main__':
    print("Running jobs API tests...\n")
    
    try:
        test_normalize_job_with_dict_location()
        test_normalize_job_with_string_location()
        test_normalize_job_with_string_location_remote()
        test_normalize_job_with_dict_location_not_remote()
        test_normalize_job_with_dict_location_missing_raw_location()
        test_list_jobs()
        test_search_jobs()
        test_list_jobs_no_keywords()
        
        print("\n" + "="*50)
        print("All tests passed! ✓")
        print("="*50)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
