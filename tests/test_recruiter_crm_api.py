"""Tests for Recruiter CRM API routes."""

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from api.routes.recruiter_crm import router


@pytest.fixture
def client():
    """Create a test client."""
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_get_crm_analytics_default_days(client):
    """Test GET /api/v1/recruiter-crm/analytics with default days parameter."""
    response = client.get("/api/v1/recruiter-crm/analytics")
    assert response.status_code == 200
    
    data = response.json()
    assert "period" in data
    assert data["period"]["days"] == 30


def test_get_crm_analytics_custom_days(client):
    """Test GET /api/v1/recruiter-crm/analytics with custom days parameter."""
    response = client.get("/api/v1/recruiter-crm/analytics?days=60")
    assert response.status_code == 200
    
    data = response.json()
    assert "period" in data
    assert data["period"]["days"] == 60


def test_get_crm_analytics_invalid_days_too_low(client):
    """Test GET /api/v1/recruiter-crm/analytics with days below minimum."""
    response = client.get("/api/v1/recruiter-crm/analytics?days=5")
    assert response.status_code == 422  # Validation error


def test_get_crm_analytics_invalid_days_too_high(client):
    """Test GET /api/v1/recruiter-crm/analytics with days above maximum."""
    response = client.get("/api/v1/recruiter-crm/analytics?days=400")
    assert response.status_code == 422  # Validation error


def test_get_crm_analytics_response_structure(client):
    """Test that the response has the expected structure."""
    response = client.get("/api/v1/recruiter-crm/analytics")
    assert response.status_code == 200
    
    data = response.json()
    assert "period" in data
    assert "metrics" in data
    assert "trends" in data
    
    # Verify period structure
    assert "start_date" in data["period"]
    assert "end_date" in data["period"]
    assert "days" in data["period"]
    
    # Verify metrics structure
    assert "total_interactions" in data["metrics"]
    assert "active_recruiters" in data["metrics"]
    assert "pending_follow_ups" in data["metrics"]
    assert "completed_interactions" in data["metrics"]
    
    # Verify trends structure
    assert "interaction_rate" in data["trends"]
    assert "response_rate" in data["trends"]
    assert "conversion_rate" in data["trends"]


def test_get_suggested_actions(client):
    """Test GET /api/v1/recruiter-crm/suggested-actions endpoint."""
    response = client.get("/api/v1/recruiter-crm/suggested-actions")
    assert response.status_code == 200
    
    data = response.json()
    assert "suggested_actions" in data
