"""
BROKEN TEST: Demonstrates the MagicMock async issue.

This test will fail with:
TypeError: object MagicMock can't be used in 'await' expression

This is the issue reported in the Sentry error.
"""
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

from .api_routes_networking import (
    router,
    get_networking_service,
    get_current_user,
    ConnectionResponseRequest,
)


def test_respond_to_connection_broken():
    """
    BROKEN TEST: This test demonstrates the issue.
    
    The problem: We're using MagicMock for an async service.
    When the endpoint tries to await the service method, it fails because
    MagicMock objects are not awaitable.
    
    Error: TypeError: object MagicMock can't be used in 'await' expression
    """
    # Create FastAPI app
    app = FastAPI()
    app.include_router(router)
    
    # ❌ WRONG: Using MagicMock for async service
    mock_service = MagicMock()
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
    
    # This will fail with 500 error because of the MagicMock issue
    # The error will be: "object MagicMock can't be used in 'await' expression"
    assert response.status_code == 500
    assert "MagicMock" in response.json()["detail"]


if __name__ == "__main__":
    # Run this to see the error
    test_respond_to_connection_broken()
    print("Test completed - error occurred as expected")
