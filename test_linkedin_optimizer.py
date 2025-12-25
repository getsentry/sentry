"""Test for LinkedIn Optimizer Service - Best Practices Endpoint

This test verifies that the get_best_practices method exists and works correctly.
"""

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from api.routes.linkedin_optimizer import router


# Create a test FastAPI app
app = FastAPI()
app.include_router(router)

client = TestClient(app)


def test_get_best_practices_no_section():
    """Test getting general best practices without specifying a section."""
    response = client.get("/api/v1/linkedin-optimizer/best-practices")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "data" in data
    assert "all_sections" in data
    assert "headline" in data["all_sections"]


def test_get_best_practices_headline():
    """Test getting best practices for headline section."""
    response = client.get("/api/v1/linkedin-optimizer/best-practices?section=headline")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["section"] == "headline"
    assert "data" in data
    assert "tips" in data["data"]
    assert len(data["data"]["tips"]) > 0


def test_get_best_practices_about():
    """Test getting best practices for about section."""
    response = client.get("/api/v1/linkedin-optimizer/best-practices?section=about")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["section"] == "about"


def test_get_best_practices_experience():
    """Test getting best practices for experience section."""
    response = client.get("/api/v1/linkedin-optimizer/best-practices?section=experience")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["section"] == "experience"


def test_get_best_practices_skills():
    """Test getting best practices for skills section."""
    response = client.get("/api/v1/linkedin-optimizer/best-practices?section=skills")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["section"] == "skills"


def test_get_best_practices_education():
    """Test getting best practices for education section."""
    response = client.get("/api/v1/linkedin-optimizer/best-practices?section=education")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["section"] == "education"


def test_get_best_practices_invalid_section():
    """Test that invalid section returns proper error response."""
    response = client.get("/api/v1/linkedin-optimizer/best-practices?section=invalid")
    # FastAPI will return 422 for pattern validation failure
    assert response.status_code == 422


def test_service_method_exists():
    """Test that the get_best_practices method exists on the service."""
    from services.linkedin_optimizer_service import LinkedInOptimizerService
    
    service = LinkedInOptimizerService()
    assert hasattr(service, "get_best_practices")
    assert callable(getattr(service, "get_best_practices"))


@pytest.mark.asyncio
async def test_service_get_best_practices_directly():
    """Test calling the service method directly."""
    from services.linkedin_optimizer_service import LinkedInOptimizerService
    
    service = LinkedInOptimizerService()
    
    # Test with no section
    result = await service.get_best_practices(section=None)
    assert result["success"] is True
    assert "all_sections" in result
    
    # Test with specific section
    result = await service.get_best_practices(section="headline")
    assert result["success"] is True
    assert result["section"] == "headline"
    assert "tips" in result["data"]


if __name__ == "__main__":
    # Run tests manually
    print("Running manual test...")
    test_get_best_practices_no_section()
    print("✓ Test 1 passed: get_best_practices without section")
    
    test_get_best_practices_headline()
    print("✓ Test 2 passed: get_best_practices with headline section")
    
    test_service_method_exists()
    print("✓ Test 3 passed: service method exists")
    
    print("\nAll manual tests passed!")
