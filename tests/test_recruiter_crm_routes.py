"""Tests for Recruiter CRM API routes."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes.recruiter_crm import router, get_service
from services.recruiter_crm_service import RecruiterCRMService


# Create test app
app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


def test_list_recruiters_endpoint(client):
    """Test the list recruiters endpoint."""
    response = client.get("/api/v1/recruiter-crm/recruiters")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "recruiters" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data
    assert data["limit"] == 50
    assert data["offset"] == 0


def test_list_recruiters_with_query_params(client):
    """Test list recruiters with query parameters."""
    response = client.get(
        "/api/v1/recruiter-crm/recruiters",
        params={
            "status": "active",
            "recruiter_type": "external",
            "company": "TechCorp",
            "specialization": "Engineering",
            "limit": 10,
            "offset": 5
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["limit"] == 10
    assert data["offset"] == 5
    assert data["filters"]["status"] == "active"
    assert data["filters"]["recruiter_type"] == "external"


def test_list_recruiters_invalid_status(client):
    """Test list recruiters with invalid status value."""
    response = client.get(
        "/api/v1/recruiter-crm/recruiters",
        params={"status": "invalid_status"}
    )
    
    # Should return 422 for validation error
    assert response.status_code == 422


def test_list_recruiters_limit_validation(client):
    """Test list recruiters with invalid limit."""
    # Limit too high
    response = client.get(
        "/api/v1/recruiter-crm/recruiters",
        params={"limit": 500}
    )
    assert response.status_code == 422
    
    # Limit too low
    response = client.get(
        "/api/v1/recruiter-crm/recruiters",
        params={"limit": 0}
    )
    assert response.status_code == 422


def test_list_recruiters_offset_validation(client):
    """Test list recruiters with invalid offset."""
    response = client.get(
        "/api/v1/recruiter-crm/recruiters",
        params={"offset": -1}
    )
    assert response.status_code == 422


def test_get_recruiter_not_found(client):
    """Test get recruiter that doesn't exist."""
    response = client.get("/api/v1/recruiter-crm/recruiters/999")
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Recruiter not found"


def test_create_recruiter(client):
    """Test creating a recruiter."""
    recruiter_data = {
        "name": "John Doe",
        "email": "john@example.com",
        "company": "TechCorp"
    }
    
    response = client.post(
        "/api/v1/recruiter-crm/recruiters",
        json=recruiter_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "John Doe"


def test_update_recruiter_not_found(client):
    """Test updating a recruiter that doesn't exist."""
    recruiter_data = {"name": "Jane Doe"}
    
    response = client.put(
        "/api/v1/recruiter-crm/recruiters/999",
        json=recruiter_data
    )
    
    assert response.status_code == 404


def test_delete_recruiter_not_found(client):
    """Test deleting a recruiter that doesn't exist."""
    response = client.delete("/api/v1/recruiter-crm/recruiters/999")
    
    assert response.status_code == 404


def test_service_dependency_injection():
    """Test that the service dependency returns correct instance."""
    service = get_service()
    
    assert isinstance(service, RecruiterCRMService)
    assert service.db_session is None
