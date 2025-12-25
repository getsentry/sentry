"""
Test suite for job routes to verify correct routing behavior.

Tests that /search route is correctly matched and not confused with /{job_id}.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api.routes.jobs import router


@pytest.fixture
def app():
    """Create a FastAPI app with the jobs router."""
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app)


def test_search_endpoint_with_query_params(client):
    """Test that /search endpoint is correctly routed with query parameters."""
    response = client.get(
        "/api/v1/jobs/search",
        params={"query": "python", "location": "San Francisco", "remote": True}
    )
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    
    assert data["query"] == "python"
    assert data["location"] == "San Francisco"
    assert data["remote"] is True
    assert "jobs" in data
    assert "total" in data


def test_search_endpoint_without_params(client):
    """Test that /search endpoint works without query parameters."""
    response = client.get("/api/v1/jobs/search")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["query"] is None
    assert data["location"] is None
    assert data["remote"] is None
    assert "jobs" in data


def test_get_job_by_id(client):
    """Test that /{job_id} endpoint works for getting a specific job."""
    response = client.get("/api/v1/jobs/job-123")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["id"] == "job-123"
    assert "title" in data
    assert "location" in data
    assert "remote" in data


def test_get_job_not_found(client):
    """Test that /{job_id} endpoint returns 404 for non-existent jobs."""
    response = client.get("/api/v1/jobs/nonexistent-job")
    
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_search_not_interpreted_as_job_id(client):
    """
    Critical test: Verify that /search is NOT interpreted as a job_id parameter.
    
    This was the original bug - the parameterized route was matching before
    the specific /search route.
    """
    response = client.get(
        "/api/v1/jobs/search",
        params={"query": "software engineer"}
    )
    
    # Should NOT return 501 "not implemented" error
    assert response.status_code != 501, \
        "Route incorrectly matched to /{job_id} instead of /search"
    
    # Should return 200 with search results
    assert response.status_code == 200
    data = response.json()
    
    # Should have search result structure, not job detail structure
    assert "query" in data, "Response should have search structure"
    assert "jobs" in data, "Response should have jobs list"
    assert data["query"] == "software engineer"


def test_route_ordering_is_correct(app):
    """Verify that routes are registered in the correct order."""
    routes = [route for route in app.routes if hasattr(route, 'path')]
    
    # Find the indices of our routes
    search_idx = None
    job_id_idx = None
    
    for idx, route in enumerate(routes):
        if route.path == "/api/v1/jobs/search":
            search_idx = idx
        elif route.path == "/api/v1/jobs/{job_id}" and route.methods == {"GET"}:
            job_id_idx = idx
    
    assert search_idx is not None, "/search route not found"
    assert job_id_idx is not None, "/{job_id} route not found"
    
    # The specific route should come before the parameterized route
    assert search_idx < job_id_idx, \
        f"Route order incorrect: /search at index {search_idx}, " \
        f"/{{job_id}} at index {job_id_idx}. " \
        "Specific routes must be registered before parameterized routes."


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])
