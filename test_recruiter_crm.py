"""Tests for the Recruiter CRM API."""
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


def test_get_pending_follow_ups_no_filters(client):
    """Test getting pending follow-ups without filters."""
    response = client.get("/api/v1/recruiter-crm/follow-ups")
    assert response.status_code == 200
    data = response.json()
    assert "follow_ups" in data
    assert "total" in data
    assert "filters" in data
    assert data["filters"]["priority"] is None
    assert data["filters"]["due_before"] is None


def test_get_pending_follow_ups_with_priority(client):
    """Test getting pending follow-ups with priority filter."""
    response = client.get("/api/v1/recruiter-crm/follow-ups?priority=high")
    assert response.status_code == 200
    data = response.json()
    assert "follow_ups" in data
    assert "total" in data
    assert "filters" in data
    assert data["filters"]["priority"] == "high"


def test_get_pending_follow_ups_with_due_before(client):
    """Test getting pending follow-ups with due_before filter."""
    response = client.get("/api/v1/recruiter-crm/follow-ups?due_before=2024-12-31")
    assert response.status_code == 200
    data = response.json()
    assert "follow_ups" in data
    assert "total" in data
    assert "filters" in data
    assert data["filters"]["due_before"] == "2024-12-31"


def test_get_pending_follow_ups_with_both_filters(client):
    """Test getting pending follow-ups with both filters."""
    response = client.get("/api/v1/recruiter-crm/follow-ups?priority=medium&due_before=2024-12-31")
    assert response.status_code == 200
    data = response.json()
    assert "follow_ups" in data
    assert "total" in data
    assert "filters" in data
    assert data["filters"]["priority"] == "medium"
    assert data["filters"]["due_before"] == "2024-12-31"


def test_get_recruiters(client):
    """Test getting recruiters."""
    response = client.get("/api/v1/recruiter-crm/recruiters")
    assert response.status_code == 200
    data = response.json()
    assert "recruiters" in data
    assert "total" in data


def test_create_recruiter(client):
    """Test creating a recruiter."""
    recruiter_data = {
        "name": "John Doe",
        "company": "Tech Corp",
        "email": "john@techcorp.com"
    }
    response = client.post("/api/v1/recruiter-crm/recruiters", json=recruiter_data)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "status" in data
    assert data["status"] == "created"


def test_create_interaction(client):
    """Test creating an interaction."""
    interaction_data = {
        "recruiter_id": "123",
        "type": "email",
        "notes": "Initial outreach"
    }
    response = client.post("/api/v1/recruiter-crm/interactions", json=interaction_data)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "status" in data
    assert data["status"] == "created"


def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
