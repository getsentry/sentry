"""
FIXED TEST: Demonstrates the correct way to mock async functions.

This test uses AsyncMock instead of MagicMock, which properly handles
async/await patterns.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

from .api_routes_networking import (
    router,
    get_networking_service,
    get_current_user,
    NetworkingService,
)


def test_respond_to_connection_fixed_with_asyncmock():
    """
    FIXED TEST: Using AsyncMock for async service methods.
    
    The solution: Use AsyncMock instead of MagicMock for async functions.
    AsyncMock is awaitable and works correctly with async/await patterns.
    
    ✅ This test will pass successfully.
    """
    # Create FastAPI app
    app = FastAPI()
    app.include_router(router)
    
    # ✅ CORRECT: Using AsyncMock for async methods
    mock_service = MagicMock(spec=NetworkingService)
    mock_service.respond_to_request = AsyncMock(return_value={
        "request_id": "7a4a9ad7-158f-40db-a930-7653498cd16e",
        "status": "accepted",
        "user_id": "168366f4-bebc-4e65-a14f-725aec84554f"
    })
    
    # Mock user
    mock_user = {
        "user_id": "168366f4-bebc-4e65-a14f-725aec84554f",
        "email": "john@example.com",
        "name": "John Smith"
    }
    
    # Override dependencies
    app.dependency_overrides[get_networking_service] = lambda: mock_service
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    # Create test client
    client = TestClient(app)
    
    # Make request
    response = client.post(
        "/api/v1/networking/connections/respond",
        json={
            "request_id": "7a4a9ad7-158f-40db-a930-7653498cd16e",
            "accept": True
        }
    )
    
    # ✅ This will pass - no MagicMock error!
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["message"] == "Request accepted"
    
    # Verify the mock was called correctly
    mock_service.respond_to_request.assert_called_once_with(
        user_id="168366f4-bebc-4e65-a14f-725aec84554f",
        request_id="7a4a9ad7-158f-40db-a930-7653498cd16e",
        accept=True
    )


def test_respond_to_connection_fixed_alternative_approach():
    """
    Alternative approach: Mock the entire service with AsyncMock.
    
    This is useful when the service has multiple async methods.
    """
    # Create FastAPI app
    app = FastAPI()
    app.include_router(router)
    
    # ✅ CORRECT: Create a mock service with AsyncMock
    mock_service = AsyncMock(spec=NetworkingService)
    mock_service.respond_to_request.return_value = {
        "request_id": "7a4a9ad7-158f-40db-a930-7653498cd16e",
        "status": "accepted",
        "user_id": "168366f4-bebc-4e65-a14f-725aec84554f"
    }
    
    # Mock user
    mock_user = {
        "user_id": "168366f4-bebc-4e65-a14f-725aec84554f",
        "email": "john@example.com",
        "name": "John Smith"
    }
    
    # Override dependencies
    app.dependency_overrides[get_networking_service] = lambda: mock_service
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    # Create test client
    client = TestClient(app)
    
    # Make request
    response = client.post(
        "/api/v1/networking/connections/respond",
        json={
            "request_id": "7a4a9ad7-158f-40db-a930-7653498cd16e",
            "accept": True
        }
    )
    
    # ✅ This will pass
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_respond_to_connection_rejection():
    """Test rejecting a connection request."""
    app = FastAPI()
    app.include_router(router)
    
    mock_service = MagicMock(spec=NetworkingService)
    mock_service.respond_to_request = AsyncMock(return_value={
        "request_id": "test-request-123",
        "status": "rejected",
        "user_id": "test-user-456"
    })
    
    mock_user = {"user_id": "test-user-456", "email": "test@example.com", "name": "Test User"}
    
    app.dependency_overrides[get_networking_service] = lambda: mock_service
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/networking/connections/respond",
        json={"request_id": "test-request-123", "accept": False}
    )
    
    assert response.status_code == 200
    assert response.json()["message"] == "Request declined"


def test_respond_to_connection_service_error():
    """Test handling service errors."""
    app = FastAPI()
    app.include_router(router)
    
    mock_service = MagicMock(spec=NetworkingService)
    # Configure the AsyncMock to raise an exception
    mock_service.respond_to_request = AsyncMock(
        side_effect=ValueError("Request not found")
    )
    
    mock_user = {"user_id": "test-user", "email": "test@example.com", "name": "Test"}
    
    app.dependency_overrides[get_networking_service] = lambda: mock_service
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/networking/connections/respond",
        json={"request_id": "invalid-id", "accept": True}
    )
    
    assert response.status_code == 404
    assert "Request not found" in response.json()["detail"]


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
