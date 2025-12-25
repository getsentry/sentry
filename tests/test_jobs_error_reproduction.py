"""
Test that specifically reproduces the original error scenario.

This test uses the exact data structure from the error report to ensure
the fix handles the AttributeError: 'dict' object has no attribute 'lower'.
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.routes.jobs import normalize_job_data


def test_exact_error_scenario():
    """
    Reproduce the exact error scenario from the bug report.
    
    This was the raw_job data that caused the AttributeError.
    """
    raw_job = {
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
    }
    
    # Before the fix, this line would fail with:
    # AttributeError: 'dict' object has no attribute 'lower'
    # at: raw_job.get('location', '').lower() == 'remote'
    
    print("Testing exact error scenario from bug report...")
    print(f"Location data type: {type(raw_job['location'])}")
    print(f"Location data: {raw_job['location']}")
    
    try:
        result = normalize_job_data(raw_job)
        print(f"\n✓ Successfully normalized job data")
        print(f"  - Job ID: {result.id}")
        print(f"  - Title: {result.title}")
        print(f"  - Company: {result.company}")
        print(f"  - Location: {result.location}")
        print(f"  - Remote: {result.remote}")
        print(f"  - Job Type: {result.job_type}")
        
        # Verify expected values
        assert result.location == 'Remote', f"Expected location 'Remote', got '{result.location}'"
        assert result.remote is True, f"Expected remote=True, got {result.remote}"
        assert result.id == 'mock_job_2'
        assert result.title == 'Staff Engineer'
        assert result.company == 'Salesforce'
        assert result.job_type == 'Full-time'
        assert result.requirements == ['Go', 'gRPC', 'Terraform', 'GCP', 'Prometheus']
        
        print("\n" + "="*60)
        print("SUCCESS: The AttributeError has been fixed! ✓")
        print("="*60)
        return True
        
    except AttributeError as e:
        print(f"\n❌ FAILED: AttributeError still occurs: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_all_job_data_from_error():
    """
    Test normalization of all jobs that were in the error report.
    """
    job_list = [
        {
            "company": 'Salesforce',
            "description": 'Drive product strategy and execution for next-generation platforms.',
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
            "skills_required": ['Go', 'gRPC', 'Terraform', 'GCP', 'Prometheus'],
            "title": 'Staff Engineer'
        },
        {
            "company": 'Palantir',
            "description": 'Build scalable systems that serve millions of users worldwide.',
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
            "skills_required": ['Machine Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'SQL'],
            "title": 'Senior Software Engineer'
        },
        {
            "company": 'Tesla',
            "description": 'Create beautiful, performant user interfaces.',
            "employment_type": 'full_time',
            "experience_level": 'mid',
            "external_id": 'google_mock_24',
            "id": 'mock_job_24',
            "location": {
                "city": 'Remote (US)',
                "country": 'US',
                "is_remote": True,
                "raw_location": 'Remote (US)',
                "state": None
            },
            "salary_range": {
                "currency": 'USD',
                "max_salary": 149314,
                "min_salary": 116254,
                "period": 'annual'
            },
            "skills_required": ['DevOps', 'CI/CD', 'Infrastructure as Code', 'Monitoring'],
            "title": 'Security Engineer'
        },
    ]
    
    print("\nTesting all jobs from error report...")
    success_count = 0
    
    for i, job in enumerate(job_list, 1):
        try:
            result = normalize_job_data(job)
            print(f"✓ Job {i}: {result.title} at {result.company} - Location: {result.location}")
            success_count += 1
        except Exception as e:
            print(f"❌ Job {i} failed: {e}")
            return False
    
    print(f"\n✓ Successfully normalized all {success_count} jobs")
    return True


if __name__ == '__main__':
    print("="*60)
    print("Testing Original Error Reproduction")
    print("="*60)
    print()
    
    success = True
    
    try:
        if not test_exact_error_scenario():
            success = False
        
        print()
        if not test_all_job_data_from_error():
            success = False
            
        if success:
            print("\n" + "="*60)
            print("ALL ERROR REPRODUCTION TESTS PASSED! ✓")
            print("The AttributeError bug has been successfully fixed.")
            print("="*60)
        else:
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
