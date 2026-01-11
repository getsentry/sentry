"""Tests for networking API - demonstrates the bug."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes.networking import router


# Create test app
app = FastAPI()
app.include_router(router, prefix="/api/v1")

client = TestClient(app)


def test_send_connection_request_bug():
    """
    Test that demonstrates the bug: 'dict' object has no attribute 'model_dump'
    
    This test will fail with AttributeError because create_connection_request
    returns a dict but the code tries to call .model_dump() on it.
    """
    response = client.post(
        "/api/v1/networking/connections/request",
        json={
            "to_user_id": "271a41d4-9d5d-41c7-af57-51a184787466",
            "message": "I'd like to connect!"
        }
    )
    
    # This should return 500 error due to the bug
    assert response.status_code == 500
    assert "'dict' object has no attribute 'model_dump'" in response.json()["detail"]


if __name__ == "__main__":
    test_send_connection_request_bug()
    print("Bug confirmed: The test shows the AttributeError occurs as expected")
