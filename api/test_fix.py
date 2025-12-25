#!/usr/bin/env python3
"""
Standalone test to verify the location dict bug fix.
This runs without pytest to avoid conflicts with Sentry's test configuration.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from api.routes.jobs import normalize_job_data


def test_location_as_dict():
    """Test that location as a dict is handled correctly (the bug fix)"""
    print("Test 1: Location as dict (the main bug fix)...")
    raw_job = {
        "id": "mock_job_32",
        "external_id": "google_mock_32",
        "title": "Security Engineer",
        "company": "Microsoft",
        "description": "Drive product strategy and execution for next-generation platforms.",
        "employment_type": "permanent",
        "experience_level": "mid",
        "location": {  # This was causing the bug
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
        "skills_required": ["Python", "Django", "PostgreSQL", "AWS", "Docker", "Kubernetes"]
    }
    
    try:
        job = normalize_job_data(raw_job)
        assert job.id == "mock_job_32"
        assert job.title == "Security Engineer"
        assert job.company == "Microsoft"
        assert job.location == "San Francisco, CA"
        assert job.remote is False
        assert len(job.requirements) == 6
        print("✓ PASS: Location dict handled correctly")
        print(f"  - Location: {job.location}")
        print(f"  - Remote: {job.remote}")
        return True
    except AttributeError as e:
        print(f"✗ FAIL: {e}")
        return False


def test_location_as_string():
    """Test that location as a string still works"""
    print("\nTest 2: Location as string...")
    raw_job = {
        "id": "mock_job_33",
        "title": "Backend Engineer",
        "company": "Google",
        "description": "Build scalable systems",
        "location": "Remote",  # String location
        "salary_range": {
            "min_salary": 150000,
            "max_salary": 250000,
            "currency": "USD",
            "period": "annual"
        },
        "skills_required": ["Python", "Go", "Kubernetes"]
    }
    
    try:
        job = normalize_job_data(raw_job)
        assert job.id == "mock_job_33"
        assert job.location == "Remote"
        assert job.remote is True
        print("✓ PASS: String location handled correctly")
        print(f"  - Location: {job.location}")
        print(f"  - Remote: {job.remote}")
        return True
    except Exception as e:
        print(f"✗ FAIL: {e}")
        return False


def test_location_dict_with_remote():
    """Test location dict with is_remote=True"""
    print("\nTest 3: Location dict with is_remote=True...")
    raw_job = {
        "id": "mock_job_34",
        "title": "DevOps Engineer",
        "company": "Cloud Co",
        "description": "Remote work",
        "location": {
            "city": "Anywhere",
            "is_remote": True,
            "raw_location": "Remote - US"
        },
        "skills_required": ["AWS", "Terraform"]
    }
    
    try:
        job = normalize_job_data(raw_job)
        assert job.location == "Remote - US"
        assert job.remote is True
        print("✓ PASS: Remote location dict handled correctly")
        print(f"  - Location: {job.location}")
        print(f"  - Remote: {job.remote}")
        return True
    except Exception as e:
        print(f"✗ FAIL: {e}")
        return False


def test_empty_location():
    """Test with empty/missing location"""
    print("\nTest 4: Empty location...")
    raw_job = {
        "id": "mock_job_35",
        "title": "Test Engineer",
        "company": "Test Corp",
        "description": "Testing",
        "skills_required": ["Testing"]
    }
    
    try:
        job = normalize_job_data(raw_job)
        assert job.location == ""
        assert job.remote is False
        print("✓ PASS: Empty location handled correctly")
        print(f"  - Location: '{job.location}'")
        print(f"  - Remote: {job.remote}")
        return True
    except Exception as e:
        print(f"✗ FAIL: {e}")
        return False


def main():
    """Run all tests"""
    print("="*60)
    print("Testing the location dict bug fix")
    print("="*60)
    
    results = []
    results.append(test_location_as_dict())
    results.append(test_location_as_string())
    results.append(test_location_dict_with_remote())
    results.append(test_empty_location())
    
    print("\n" + "="*60)
    print(f"Results: {sum(results)}/{len(results)} tests passed")
    print("="*60)
    
    if all(results):
        print("\n✓ All tests passed! The bug is fixed.")
        return 0
    else:
        print("\n✗ Some tests failed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
