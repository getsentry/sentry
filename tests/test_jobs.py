"""
Tests for the jobs API to verify the fix for the location dict bug.
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
import sys
import os

# Add api module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from api.routes.jobs import router, normalize_job_data, Job


# Create test app
app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestJobNormalization:
    """Tests for normalize_job_data function"""
    
    def test_normalize_job_with_location_dict(self):
        """Test that location as a dict is handled correctly (the bug fix)"""
        raw_job = {
            "id": "test_job_1",
            "title": "Software Engineer",
            "company": "Tech Corp",
            "description": "Great job",
            "location": {
                "city": "San Francisco",
                "state": "CA",
                "country": "US",
                "raw_location": "San Francisco, CA",
                "is_remote": False
            },
            "salary_range": {
                "min_salary": 100000,
                "max_salary": 150000,
                "currency": "USD",
                "period": "annual"
            },
            "skills_required": ["Python", "Django"]
        }
        
        # This should NOT raise AttributeError anymore
        job = normalize_job_data(raw_job)
        
        assert job.id == "test_job_1"
        assert job.title == "Software Engineer"
        assert job.location == "San Francisco, CA"
        assert job.remote is False
        assert len(job.requirements) == 2
    
    def test_normalize_job_with_location_string(self):
        """Test that location as a string still works"""
        raw_job = {
            "id": "test_job_2",
            "title": "Backend Engineer",
            "company": "Startup Inc",
            "description": "Exciting opportunity",
            "location": "Remote",
            "salary_range": {
                "min_salary": 120000,
                "max_salary": 180000,
                "currency": "USD",
                "period": "annual"
            },
            "skills_required": ["Go", "Kubernetes"]
        }
        
        job = normalize_job_data(raw_job)
        
        assert job.id == "test_job_2"
        assert job.location == "Remote"
        assert job.remote is True  # Should detect "remote" string
    
    def test_normalize_job_with_remote_dict_location(self):
        """Test location dict with is_remote=True"""
        raw_job = {
            "id": "test_job_3",
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
        
        job = normalize_job_data(raw_job)
        
        assert job.location == "Remote - US"
        assert job.remote is True


class TestJobSearchAPI:
    """Tests for the job search API endpoint"""
    
    def test_search_jobs_endpoint(self):
        """Test POST /api/v1/jobs/search endpoint"""
        response = client.post(
            "/api/v1/jobs/search",
            json={
                "keywords": "python",
                "location": "San Francisco",
                "remote": True,
                "limit": 10
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "jobs" in data
        assert "total_results" in data
        assert isinstance(data["jobs"], list)
        
        # Should have jobs without crashing
        assert len(data["jobs"]) > 0
        
        # Check first job structure
        first_job = data["jobs"][0]
        assert "id" in first_job
        assert "title" in first_job
        assert "company" in first_job
        assert "location" in first_job
        assert "remote" in first_job
        assert isinstance(first_job["location"], str)  # Location should be string, not dict
    
    def test_get_jobs_endpoint(self):
        """Test GET /api/v1/jobs endpoint"""
        response = client.get(
            "/api/v1/jobs",
            params={
                "keywords": "python",
                "location": "remote",
                "limit": 10
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "jobs" in data
        assert len(data["jobs"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
