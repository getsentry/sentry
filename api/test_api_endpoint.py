#!/usr/bin/env python3
"""
Test the full API endpoint to verify the bug fix works end-to-end.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_health_endpoint():
    """Test health check endpoint"""
    print("Test: Health check endpoint...")
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("✓ PASS: Health check works")


def test_post_search_jobs():
    """Test POST /api/v1/jobs/search endpoint with the bug scenario"""
    print("\nTest: POST /api/v1/jobs/search (the exact scenario from the error)...")
    
    # This is the exact request that was failing
    response = client.post(
        "/api/v1/jobs/search",
        json={
            "keywords": "python",
            "location": "San Francisco",
            "remote": True,
            "limit": 10
        }
    )
    
    print(f"  Status code: {response.status_code}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    data = response.json()
    print(f"  Total results: {data.get('total_results')}")
    print(f"  Number of jobs: {len(data.get('jobs', []))}")
    
    # Verify response structure
    assert "jobs" in data
    assert "total_results" in data
    assert "query" in data
    assert isinstance(data["jobs"], list)
    
    # Check that we have results
    assert len(data["jobs"]) > 0, "Should have at least one job"
    
    # Verify first job structure and that location is a string (not dict)
    first_job = data["jobs"][0]
    print(f"  First job: {first_job['title']} at {first_job['company']}")
    print(f"  Location: {first_job['location']} (type: {type(first_job['location']).__name__})")
    print(f"  Remote: {first_job['remote']}")
    
    assert isinstance(first_job["location"], str), "Location should be a string, not a dict"
    assert "id" in first_job
    assert "title" in first_job
    assert "company" in first_job
    assert "remote" in first_job
    
    print("✓ PASS: Job search endpoint works correctly")


def test_get_jobs():
    """Test GET /api/v1/jobs endpoint"""
    print("\nTest: GET /api/v1/jobs...")
    
    response = client.get(
        "/api/v1/jobs",
        params={
            "keywords": "python",
            "location": "remote",
            "limit": 10
        }
    )
    
    print(f"  Status code: {response.status_code}")
    assert response.status_code == 200
    
    data = response.json()
    assert "jobs" in data
    assert len(data["jobs"]) > 0
    
    print(f"  Found {len(data['jobs'])} jobs")
    print("✓ PASS: GET endpoint works correctly")


def main():
    """Run all API tests"""
    print("="*60)
    print("Testing the Jobs API endpoint with the bug fix")
    print("="*60)
    
    try:
        test_health_endpoint()
        test_post_search_jobs()
        test_get_jobs()
        
        print("\n" + "="*60)
        print("✓ All API tests passed!")
        print("="*60)
        print("\nThe bug is fixed and the API is working correctly.")
        print("The HTTPException 'dict' object has no attribute 'lower' is resolved.")
        return 0
        
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
