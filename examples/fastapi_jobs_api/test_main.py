"""
Test suite for Jobs API - Demonstrating the fix

This test suite verifies that:
1. The /jobs/{job_id} endpoint now works properly
2. The /jobs/search endpoint works
3. Error handling is working correctly
4. 501 errors don't cascade to 500 errors
"""

import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


class TestJobsAPI:
    """Test suite for Jobs API endpoints."""
    
    def test_health_check(self):
        """Test that health check endpoint works."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_job_detail_success(self):
        """
        Test that job detail endpoint returns job data.
        
        This test verifies the fix - the endpoint now returns job details
        instead of raising a 501 error.
        """
        response = client.get("/api/v1/jobs/job_001")
        assert response.status_code == 200
        
        job = response.json()
        assert job["id"] == "job_001"
        assert job["title"] == "Senior Software Engineer"
        assert job["company"] == "Tech Corp"
        assert job["remote"] is True
    
    def test_job_detail_not_found(self):
        """
        Test that job detail endpoint returns 404 for non-existent job.
        
        This verifies proper error handling - 404 instead of 501.
        """
        response = client.get("/api/v1/jobs/nonexistent")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_job_search_basic(self):
        """Test basic job search functionality."""
        response = client.get("/api/v1/jobs/search")
        assert response.status_code == 200
        
        data = response.json()
        assert "jobs" in data
        assert "total" in data
        assert isinstance(data["jobs"], list)
        assert data["total"] > 0
    
    def test_job_search_with_query(self):
        """Test job search with query parameter."""
        response = client.get("/api/v1/jobs/search?query=python")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["jobs"]) > 0
        
        # Verify the search works
        for job in data["jobs"]:
            assert (
                "python" in job["title"].lower() or
                "python" in job["description"].lower()
            )
    
    def test_job_search_with_location(self):
        """Test job search with location filter."""
        response = client.get("/api/v1/jobs/search?location=San+Francisco")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["jobs"]) > 0
        
        for job in data["jobs"]:
            assert "san francisco" in job["location"].lower()
    
    def test_job_search_with_remote_filter(self):
        """Test job search with remote filter."""
        response = client.get("/api/v1/jobs/search?remote=true")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["jobs"]) > 0
        
        for job in data["jobs"]:
            assert job["remote"] is True
    
    def test_job_search_combined_filters(self):
        """Test job search with multiple filters."""
        response = client.get(
            "/api/v1/jobs/search?query=software&location=San+Francisco&remote=true"
        )
        assert response.status_code == 200
        
        data = response.json()
        # This specific combination should return results
        assert data["total"] > 0
    
    def test_job_search_pagination(self):
        """Test job search pagination."""
        response = client.get("/api/v1/jobs/search?page=1&per_page=2")
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 1
        assert data["per_page"] == 2
        assert len(data["jobs"]) <= 2
    
    def test_request_id_in_headers(self):
        """Test that request ID is added to response headers."""
        response = client.get("/health")
        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) == 8
    
    def test_http_exception_handling(self):
        """
        Test that HTTP exceptions are properly handled.
        
        This verifies that 404 errors are returned with proper JSON format
        and don't cascade into 500 errors.
        """
        response = client.get("/api/v1/jobs/invalid_id")
        assert response.status_code == 404
        
        error_data = response.json()
        assert "detail" in error_data
        assert "status_code" in error_data
        assert error_data["status_code"] == 404


class TestErrorHandling:
    """Test suite specifically for error handling scenarios."""
    
    def test_404_error_format(self):
        """Test that 404 errors have consistent format."""
        response = client.get("/api/v1/jobs/nonexistent_job")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "status_code" in data
        assert data["status_code"] == 404
    
    def test_validation_error_format(self):
        """Test that validation errors return 422."""
        response = client.get("/api/v1/jobs/search?page=-1")
        assert response.status_code == 422
        
        data = response.json()
        assert "detail" in data or "errors" in data
    
    def test_no_cascading_errors(self):
        """
        Critical test: Verify that internal errors don't cascade.
        
        This test ensures that when an endpoint returns an error status
        (like 404), it doesn't cause other parts of the application to fail
        with 500 errors.
        """
        # First request returns 404
        response1 = client.get("/api/v1/jobs/nonexistent")
        assert response1.status_code == 404
        
        # Subsequent requests should still work fine
        response2 = client.get("/health")
        assert response2.status_code == 200
        
        response3 = client.get("/api/v1/jobs/job_001")
        assert response3.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
