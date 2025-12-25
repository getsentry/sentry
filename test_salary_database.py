"""Test for salary database API endpoints."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api.routes.salary_database import router
from middleware.logging import LoggingMiddleware
from middleware.security import SecurityHeadersMiddleware, RateLimitMiddleware


# Create test app
app = FastAPI()

# Add middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)
app.add_middleware(LoggingMiddleware)

# Include router
app.include_router(router)

# Create test client
client = TestClient(app)


def test_get_company_salaries():
    """Test getting company salaries - this was failing with TypeError."""
    # This is the exact request that was failing
    response = client.get("/api/v1/salary-database/company/google")
    
    # Should not raise TypeError anymore
    assert response.status_code == 200
    
    # Verify response structure
    data = response.json()
    assert "company" in data
    assert data["company"] == "google"
    assert "salaries" in data


def test_get_company_salaries_with_filters():
    """Test getting company salaries with role and level filters."""
    response = client.get(
        "/api/v1/salary-database/company/google",
        params={"role": "engineer", "level": "senior"}
    )
    
    assert response.status_code == 200
    
    data = response.json()
    assert data["company"] == "google"
    assert data["role_filter"] == "engineer"
    assert data["level_filter"] == "senior"


def test_get_company_statistics():
    """Test getting company statistics."""
    response = client.get("/api/v1/salary-database/company/google/statistics")
    
    assert response.status_code == 200
    
    data = response.json()
    assert "company" in data
    assert data["company"] == "google"
    assert "average" in data
    assert "median" in data


def test_get_all_companies():
    """Test getting all companies."""
    response = client.get("/api/v1/salary-database/companies")
    
    assert response.status_code == 200
    
    data = response.json()
    assert "companies" in data
    assert isinstance(data["companies"], list)


if __name__ == "__main__":
    # Run the test that was failing
    print("Testing the fix for TypeError...")
    test_get_company_salaries()
    print("✓ Test passed! The TypeError has been fixed.")
    
    print("\nTesting with filters...")
    test_get_company_salaries_with_filters()
    print("✓ Test with filters passed!")
    
    print("\nTesting statistics endpoint...")
    test_get_company_statistics()
    print("✓ Statistics endpoint passed!")
    
    print("\nTesting companies list...")
    test_get_all_companies()
    print("✓ Companies list passed!")
    
    print("\n✅ All tests passed!")
