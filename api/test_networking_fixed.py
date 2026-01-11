"""Tests for networking API - verifies the fix works."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes.networking import router


# Create test app
app = FastAPI()
app.include_router(router, prefix="/api/v1")

client = TestClient(app)


def test_send_connection_request_fixed():
    """
    Test that verifies the fix: create_connection_request now returns a Pydantic model.
    
    This test should pass because create_connection_request now returns a
    ConnectionRequest Pydantic model with a model_dump() method.
    """
    response = client.post(
        "/api/v1/networking/connections/request",
        json={
            "to_user_id": "271a41d4-9d5d-41c7-af57-51a184787466",
            "message": "I'd like to connect!"
        }
    )
    
    # Should return 200 success
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
    
    data = response.json()
    assert data["success"] is True
    assert "data" in data
    assert data["message"] == "Connection request sent"
    
    # Verify the connection request data
    conn_request = data["data"]
    assert "id" in conn_request
    assert conn_request["from_user_id"] == "040dc2a4-7ba0-40a5-b307-4153b570362b"
    assert conn_request["to_user_id"] == "271a41d4-9d5d-41c7-af57-51a184787466"
    assert conn_request["message"] == "I'd like to connect!"
    assert conn_request["status"] == "pending"
    assert "created_at" in conn_request
    assert "updated_at" in conn_request
    
    print("✓ Test passed! The fix works correctly.")
    return True


def test_get_connection_requests():
    """Test getting connection requests."""
    response = client.get("/api/v1/networking/connections/requests")
    assert response.status_code == 200
    print("✓ Get connection requests works")


def test_get_profile():
    """Test getting user profile."""
    response = client.get("/api/v1/networking/profile")
    assert response.status_code == 200
    print("✓ Get profile works")


def test_get_user_profile():
    """Test getting another user's profile."""
    response = client.get("/api/v1/networking/profile/040dc2a4-7ba0-40a5-b307-4153b570362b")
    assert response.status_code == 200
    print("✓ Get user profile works")


def test_update_profile():
    """Test updating profile."""
    response = client.put("/api/v1/networking/profile")
    assert response.status_code == 200
    print("✓ Update profile works")


if __name__ == "__main__":
    print("Running tests to verify the fix...\n")
    
    try:
        test_send_connection_request_fixed()
        test_get_connection_requests()
        test_get_profile()
        test_get_user_profile()
        test_update_profile()
        
        print("\n" + "="*60)
        print("✓ ALL TESTS PASSED! The bug has been fixed.")
        print("="*60)
        
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        raise
