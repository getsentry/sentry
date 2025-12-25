"""
Tests for applications API to verify the NameError fix.
"""
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from fastapi import FastAPI

from api.routes.applications import router, db, UpdateApplicationRequest


# Create a test app
app = FastAPI()
app.include_router(router)
client = TestClient(app)


def test_update_application_with_notes():
    """Test that the update_application endpoint works without NameError."""
    # First, create an application in the mock database
    application_id = str(uuid4())
    db.applications[application_id] = {
        "status": "pending",
        "priority": "high",
        "notes": "Initial notes",
        "interview_date": None,
        "follow_up_date": None,
        "salary_offered": None,
        "last_updated": "2025-12-24T00:00:00"
    }
    
    # Now update it with new notes
    response = client.put(
        f"/api/v1/applications/{application_id}",
        json={"notes": "Updated notes after interview"}
    )
    
    # Should return 200 OK, not 500 Internal Server Error
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
    
    # Verify the response contains the updated data
    data = response.json()
    assert data["notes"] == "Updated notes after interview"
    assert "last_updated" in data
    

def test_update_application_not_found():
    """Test that updating a non-existent application returns 404."""
    non_existent_id = str(uuid4())
    
    response = client.put(
        f"/api/v1/applications/{non_existent_id}",
        json={"notes": "Some notes"}
    )
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_update_application_multiple_fields():
    """Test updating multiple fields at once."""
    application_id = str(uuid4())
    db.applications[application_id] = {
        "status": "pending",
        "priority": "medium",
        "notes": "Initial",
        "interview_date": None,
        "follow_up_date": None,
        "salary_offered": None,
        "last_updated": "2025-12-24T00:00:00"
    }
    
    response = client.put(
        f"/api/v1/applications/{application_id}",
        json={
            "status": "interviewed",
            "notes": "Good interview",
            "salary_offered": 120000.0
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "interviewed"
    assert data["notes"] == "Good interview"
    assert data["salary_offered"] == 120000.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
