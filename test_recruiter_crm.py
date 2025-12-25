"""Test the recruiter CRM API endpoints."""
import pytest
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_add_recruiter_with_specializations():
    """Test adding a recruiter with specializations (the fix for the reported bug)."""
    # This is the exact request from the error trace
    recruiter_data = {
        "name": "Jane Smith",
        "email": "jane@techrecruit.com",
        "linkedin_url": "https://linkedin.com/in/janesmith",
        "company": "TechRecruit Inc",
        "recruiter_type": "internal",
        "specializations": ["Python", "DevOps", "Cloud Engineering"]  # The parameter that was causing the error
    }

    response = client.post("/api/v1/recruiter-crm/recruiters", json=recruiter_data)

    # Should succeed now that the service method accepts specializations
    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "Jane Smith"
    assert data["email"] == "jane@techrecruit.com"
    assert data["company"] == "TechRecruit Inc"
    assert data["recruiter_type"] == "internal"
    assert data["specializations"] == ["Python", "DevOps", "Cloud Engineering"]
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_add_recruiter_without_specializations():
    """Test adding a recruiter without specializations (optional parameter)."""
    recruiter_data = {
        "name": "John Doe",
        "email": "john@example.com",
        "company": "Example Corp"
    }

    response = client.post("/api/v1/recruiter-crm/recruiters", json=recruiter_data)

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "John Doe"
    assert data["email"] == "john@example.com"
    assert data["specializations"] == []  # Should default to empty list
    assert "id" in data


def test_add_recruiter_with_all_fields():
    """Test adding a recruiter with all optional fields."""
    recruiter_data = {
        "name": "Sarah Johnson",
        "email": "sarah@techcorp.com",
        "phone": "+1-555-0123",
        "linkedin_url": "https://linkedin.com/in/sarahjohnson",
        "company": "Tech Corp",
        "recruiter_type": "agency",
        "specializations": ["AI/ML", "Data Science"],
        "companies_recruited_for": ["Google", "Meta", "Amazon"],
        "notes": "Excellent at finding senior engineers",
        "tags": ["preferred", "senior-roles", "tech"]
    }

    response = client.post("/api/v1/recruiter-crm/recruiters", json=recruiter_data)

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "Sarah Johnson"
    assert data["specializations"] == ["AI/ML", "Data Science"]
    assert data["companies_recruited_for"] == ["Google", "Meta", "Amazon"]
    assert data["notes"] == "Excellent at finding senior engineers"
    assert data["tags"] == ["preferred", "senior-roles", "tech"]


def test_get_recruiter():
    """Test retrieving a recruiter by ID."""
    # First create a recruiter
    create_response = client.post("/api/v1/recruiter-crm/recruiters", json={
        "name": "Test Recruiter",
        "email": "test@example.com"
    })
    assert create_response.status_code == 201
    recruiter_id = create_response.json()["id"]

    # Then retrieve it
    get_response = client.get(f"/api/v1/recruiter-crm/recruiters/{recruiter_id}")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["id"] == recruiter_id
    assert data["name"] == "Test Recruiter"


def test_list_recruiters():
    """Test listing all recruiters."""
    # Create a few recruiters first
    for i in range(3):
        client.post("/api/v1/recruiter-crm/recruiters", json={
            "name": f"Recruiter {i}",
            "email": f"recruiter{i}@example.com"
        })

    # List all recruiters
    response = client.get("/api/v1/recruiter-crm/recruiters")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3


def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
