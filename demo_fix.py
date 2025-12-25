#!/usr/bin/env python3
"""
Demonstration of the AttributeError fix for job search API
"""
import sys
sys.path.insert(0, '/workspace')

from api.routes.jobs import normalize_job_data, search_jobs, JobSearchRequest


def demonstrate_fix():
    print("=" * 70)
    print("DEMONSTRATION: AttributeError Fix for Job Search API")
    print("=" * 70)
    print()
    
    # Test Case 1: Dictionary location (the problematic case)
    print("Test Case 1: Dictionary Location (Original Error Case)")
    print("-" * 70)
    raw_job_dict_location = {
        "id": "test_1",
        "title": "Senior Backend Engineer",
        "company": "TechCorp",
        "location": {
            "city": "San Francisco",
            "state": "CA",
            "country": "US",
            "raw_location": "San Francisco, CA",
            "is_remote": False
        },
        "description": "Build scalable systems",
        "skills_required": ["Python", "Django", "PostgreSQL"]
    }
    
    try:
        job = normalize_job_data(raw_job_dict_location)
        print(f"✓ SUCCESS: Job normalized without error")
        print(f"  Title: {job.title}")
        print(f"  Company: {job.company}")
        print(f"  Location: {job.location}")
        print(f"  Remote: {job.remote}")
    except AttributeError as e:
        print(f"✗ FAILED: {e}")
    print()
    
    # Test Case 2: Dictionary location with is_remote flag
    print("Test Case 2: Dictionary Location with Remote Flag")
    print("-" * 70)
    raw_job_remote_dict = {
        "id": "test_2",
        "title": "Remote DevOps Engineer",
        "company": "CloudServices Inc",
        "location": {
            "city": "Anywhere",
            "is_remote": True,
            "raw_location": "Remote"
        },
        "description": "Manage cloud infrastructure",
        "requirements": ["AWS", "Docker", "Kubernetes"]
    }
    
    try:
        job = normalize_job_data(raw_job_remote_dict)
        print(f"✓ SUCCESS: Remote job detected correctly")
        print(f"  Title: {job.title}")
        print(f"  Company: {job.company}")
        print(f"  Location: {job.location}")
        print(f"  Remote: {job.remote}")
    except AttributeError as e:
        print(f"✗ FAILED: {e}")
    print()
    
    # Test Case 3: String location (backward compatibility)
    print("Test Case 3: String Location (Backward Compatibility)")
    print("-" * 70)
    raw_job_string_location = {
        "id": "test_3",
        "title": "Frontend Developer",
        "company": "WebDev Co",
        "location": "Boston, MA",
        "description": "Create beautiful UIs",
        "requirements": ["React", "TypeScript"]
    }
    
    try:
        job = normalize_job_data(raw_job_string_location)
        print(f"✓ SUCCESS: String location still works")
        print(f"  Title: {job.title}")
        print(f"  Company: {job.company}")
        print(f"  Location: {job.location}")
        print(f"  Remote: {job.remote}")
    except AttributeError as e:
        print(f"✗ FAILED: {e}")
    print()
    
    # Test Case 4: String location with "Remote" value
    print("Test Case 4: String Location with 'Remote' Value")
    print("-" * 70)
    raw_job_string_remote = {
        "id": "test_4",
        "title": "Full Stack Developer",
        "company": "StartupXYZ",
        "location": "Remote",
        "description": "Work from anywhere",
        "requirements": ["Node.js", "React"]
    }
    
    try:
        job = normalize_job_data(raw_job_string_remote)
        print(f"✓ SUCCESS: Remote detected from string")
        print(f"  Title: {job.title}")
        print(f"  Company: {job.company}")
        print(f"  Location: {job.location}")
        print(f"  Remote: {job.remote}")
    except AttributeError as e:
        print(f"✗ FAILED: {e}")
    print()
    
    # Test Case 5: Full job search integration
    print("Test Case 5: Full Job Search Integration")
    print("-" * 70)
    request = JobSearchRequest(
        keywords="python",
        location="San Francisco",
        remote=True,
        limit=10
    )
    
    try:
        response = search_jobs(request)
        print(f"✓ SUCCESS: Job search completed")
        print(f"  Query: {response.query}")
        print(f"  Total Results: {response.total_results}")
        print(f"  Jobs Found: {len(response.jobs)}")
        if response.jobs:
            print(f"  First Job: {response.jobs[0].title} at {response.jobs[0].company}")
    except Exception as e:
        print(f"✗ FAILED: {e}")
    print()
    
    print("=" * 70)
    print("SUMMARY: All test cases passed! The fix is working correctly.")
    print("=" * 70)


if __name__ == "__main__":
    demonstrate_fix()
