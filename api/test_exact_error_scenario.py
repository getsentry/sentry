#!/usr/bin/env python3
"""
Test the EXACT error scenario from the Sentry error report.

This test uses the exact variable values from the exception to ensure
the bug is properly fixed.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from api.routes.jobs import normalize_job_data


def test_exact_error_scenario():
    """
    Test with the exact raw_job data from the Sentry error report.
    
    This is the data that was causing the AttributeError:
    'dict' object has no attribute 'lower'
    """
    print("="*70)
    print("Testing EXACT error scenario from Sentry error report")
    print("="*70)
    
    # This is the EXACT raw_job value from the exception trace
    raw_job = {
        "company": "Microsoft",
        "description": "Drive product strategy and execution for next-generation platforms. Work directly with executive leadership and cross-functional teams.",
        "employment_type": "permanent",
        "experience_level": "mid",
        "external_id": "google_mock_32",
        "id": "mock_job_32",
        "location": {  # This dict was causing .lower() to fail
            "city": "San Francisco",
            "country": "US",
            "is_remote": False,
            "raw_location": "San Francisco, CA",
            "state": "CA"
        },
        "salary_range": {
            "currency": "USD",
            "max_salary": 222129,
            "min_salary": 143654,
            "period": "annual"
        },
        "skills_required": [
            "Python",
            "Django",
            "PostgreSQL",
            "AWS",
            "Docker",
            "Kubernetes"
        ],
        "title": "Security Engineer"
    }
    
    print("\nInput data (raw_job):")
    print(f"  ID: {raw_job['id']}")
    print(f"  Title: {raw_job['title']}")
    print(f"  Company: {raw_job['company']}")
    print(f"  Location type: {type(raw_job['location']).__name__}")
    print(f"  Location value: {raw_job['location']}")
    
    print("\n" + "-"*70)
    print("Calling normalize_job_data()...")
    print("-"*70)
    
    try:
        # This call was raising: AttributeError: 'dict' object has no attribute 'lower'
        # at line: remote=raw_job.get('remote', False) or raw_job.get('location', '').lower() == 'remote'
        job = normalize_job_data(raw_job)
        
        print("\n✓ SUCCESS! No AttributeError raised.")
        print("\nNormalized job data:")
        print(f"  ID: {job.id}")
        print(f"  Title: {job.title}")
        print(f"  Company: {job.company}")
        print(f"  Location: {job.location} (type: {type(job.location).__name__})")
        print(f"  Remote: {job.remote}")
        print(f"  Description: {job.description[:60]}...")
        print(f"  Requirements: {', '.join(job.requirements)}")
        print(f"  Salary: {job.salary_range}")
        print(f"  Job Type: {job.job_type}")
        print(f"  Source: {job.source}")
        
        # Verify the data is correct
        assert job.id == "mock_job_32"
        assert job.title == "Security Engineer"
        assert job.company == "Microsoft"
        assert job.location == "San Francisco, CA"
        assert isinstance(job.location, str), "Location must be a string"
        assert job.remote is False
        assert len(job.requirements) == 6
        assert "Python" in job.requirements
        
        print("\n" + "="*70)
        print("✓ ALL ASSERTIONS PASSED")
        print("="*70)
        print("\nConclusion:")
        print("  The bug is FIXED. The exact error scenario from Sentry now works.")
        print("  Location dicts are properly handled and converted to strings.")
        print("  The AttributeError: 'dict' object has no attribute 'lower' is resolved.")
        return True
        
    except AttributeError as e:
        print(f"\n✗ FAILED: AttributeError still occurs!")
        print(f"  Error: {e}")
        print("\nThe bug is NOT fixed.")
        import traceback
        traceback.print_exc()
        return False
        
    except Exception as e:
        print(f"\n✗ FAILED: Unexpected error!")
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_exact_error_scenario()
    sys.exit(0 if success else 1)
