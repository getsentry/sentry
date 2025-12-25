#!/usr/bin/env python3
"""
Integration test for the follow-ups endpoint.

This tests the complete flow from FastAPI route to service method.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from fastapi import FastAPI

from api.routes.recruiter_crm import router


def test_integration():
    """Test the complete FastAPI integration."""
    print("=" * 80)
    print("Integration Test: /api/v1/recruiter-crm/follow-ups Endpoint")
    print("=" * 80)
    print()
    
    # Create a test FastAPI app
    app = FastAPI()
    app.include_router(router)
    
    client = TestClient(app)
    
    # Test 1: GET without parameters
    print("Test 1: GET /api/v1/recruiter-crm/follow-ups (no params)")
    response = client.get("/api/v1/recruiter-crm/follow-ups")
    print(f"  Status: {response.status_code}")
    print(f"  Response: {response.json()}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert "follow_ups" in response.json()
    print("  ✅ PASS")
    print()
    
    # Test 2: GET with priority parameter
    print("Test 2: GET /api/v1/recruiter-crm/follow-ups?priority=high")
    response = client.get("/api/v1/recruiter-crm/follow-ups?priority=high")
    print(f"  Status: {response.status_code}")
    data = response.json()
    print(f"  Response: {data}")
    assert response.status_code == 200
    assert data["filters"]["priority"] == "high"
    print("  ✅ PASS")
    print()
    
    # Test 3: GET with due_before parameter
    print("Test 3: GET /api/v1/recruiter-crm/follow-ups?due_before=2025-12-31")
    response = client.get("/api/v1/recruiter-crm/follow-ups?due_before=2025-12-31")
    print(f"  Status: {response.status_code}")
    data = response.json()
    print(f"  Response: {data}")
    assert response.status_code == 200
    assert data["filters"]["due_before"] == "2025-12-31"
    print("  ✅ PASS")
    print()
    
    # Test 4: GET with all parameters
    print("Test 4: GET /api/v1/recruiter-crm/follow-ups?priority=medium&due_before=2025-12-31")
    response = client.get(
        "/api/v1/recruiter-crm/follow-ups?priority=medium&due_before=2025-12-31"
    )
    print(f"  Status: {response.status_code}")
    data = response.json()
    print(f"  Response: {data}")
    assert response.status_code == 200
    assert data["filters"]["priority"] == "medium"
    assert data["filters"]["due_before"] == "2025-12-31"
    print("  ✅ PASS")
    print()
    
    print("=" * 80)
    print("All integration tests passed! ✅")
    print("=" * 80)
    print()
    print("The endpoint /api/v1/recruiter-crm/follow-ups is working correctly.")
    print("The AttributeError has been completely resolved.")
    

if __name__ == "__main__":
    try:
        test_integration()
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
