"""
Tests for the applications API endpoints.

This test suite verifies that the application statistics endpoint
correctly handles async operations and returns expected data.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api.routes.applications import router, get_application_stats


# Create a test FastAPI app
app = FastAPI()
app.include_router(router, prefix="/api/v1/applications")


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


def test_get_application_stats_endpoint_success(client):
    """
    Test that the stats endpoint returns successfully.
    
    This test verifies that:
    1. The endpoint returns a 200 status code
    2. The response contains the expected fields
    3. The async function is properly awaited (no coroutine error)
    """
    response = client.get("/api/v1/applications/stats")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    
    # Verify all expected fields are present
    assert "total_applications" in data
    assert "by_status" in data
    assert "by_priority" in data
    assert "response_rate" in data
    assert "interview_rate" in data
    assert "offer_rate" in data
    assert "average_time_to_response" in data
    
    # Verify data types
    assert isinstance(data["total_applications"], int)
    assert isinstance(data["by_status"], dict)
    assert isinstance(data["by_priority"], dict)
    assert isinstance(data["response_rate"], (int, float))
    assert isinstance(data["interview_rate"], (int, float))
    assert isinstance(data["offer_rate"], (int, float))


@pytest.mark.asyncio
async def test_get_application_stats_function():
    """
    Test the get_application_stats function directly.
    
    This test verifies that the async function returns a dictionary
    with the expected structure.
    """
    stats = await get_application_stats()
    
    assert isinstance(stats, dict)
    assert "total_applications" in stats
    assert "by_status" in stats
    assert "by_priority" in stats
    assert "response_rate" in stats
    assert "interview_rate" in stats
    assert "offer_rate" in stats


def test_get_application_stats_no_coroutine_error(client):
    """
    Test that the endpoint doesn't return a coroutine error.
    
    This is a regression test for the bug where get_application_stats()
    was called without await, causing an AttributeError about the
    coroutine object not having a 'get' method.
    """
    response = client.get("/api/v1/applications/stats")
    
    # If the bug exists, we'd get a 500 error with the message:
    # "Failed to get stats: 'coroutine' object has no attribute 'get'"
    assert response.status_code != 500 or "coroutine" not in response.json().get("detail", "")
    
    # The correct response should be 200
    assert response.status_code == 200
