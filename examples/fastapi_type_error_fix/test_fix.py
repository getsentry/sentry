"""Test to verify the fix works correctly."""

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI


def create_app(use_broken=False):
    """Create a FastAPI app for testing."""
    app = FastAPI()

    # Import the appropriate service version
    if use_broken:
        from service_broken import OfferComparisonService
    else:
        from service_fixed import OfferComparisonService

    def get_service():
        return OfferComparisonService()

    from fastapi import Depends, APIRouter
    from models import ComparisonRequest, ComparisonResult

    router = APIRouter(prefix="/api/v1/offer-comparison")

    @router.post("/compare", response_model=ComparisonResult)
    async def compare_offers(
        request: ComparisonRequest,
        service=Depends(get_service)
    ):
        result = await service.compare_offers(
            offer_ids=request.offer_ids,
            priority_weights=request.priority_weights,
            target_location=request.target_location
        )
        return result

    app.include_router(router)
    return app


@pytest.mark.asyncio
async def test_broken_service_raises_type_error():
    """Test that the broken service raises a TypeError."""
    app = create_app(use_broken=True)
    client = TestClient(app)

    response = client.post(
        "/api/v1/offer-comparison/compare",
        json={
            "offer_ids": [
                "31276793-62bb-49a3-b850-62f58f092c68",
                "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"
            ]
        }
    )

    # The broken version should return a 500 error due to TypeError
    assert response.status_code == 500


@pytest.mark.asyncio
async def test_fixed_service_works():
    """Test that the fixed service works correctly."""
    app = create_app(use_broken=False)
    client = TestClient(app)

    response = client.post(
        "/api/v1/offer-comparison/compare",
        json={
            "offer_ids": [
                "31276793-62bb-49a3-b850-62f58f092c68",
                "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"
            ]
        }
    )

    # The fixed version should work without errors
    assert response.status_code == 200

    data = response.json()
    assert "offers" in data
    assert len(data["offers"]) == 2
    assert data["best_match"] == "31276793-62bb-49a3-b850-62f58f092c68"


@pytest.mark.asyncio
async def test_fixed_service_with_priority_weights():
    """Test that the fixed service accepts priority_weights parameter."""
    app = create_app(use_broken=False)
    client = TestClient(app)

    response = client.post(
        "/api/v1/offer-comparison/compare",
        json={
            "offer_ids": [
                "31276793-62bb-49a3-b850-62f58f092c68",
                "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"
            ],
            "priority_weights": {
                "salary": 0.4,
                "location": 0.3,
                "benefits": 0.3
            },
            "target_location": "San Francisco"
        }
    )

    # Should work with all parameters
    assert response.status_code == 200

    data = response.json()
    assert "offers" in data
    assert len(data["offers"]) == 2


if __name__ == "__main__":
    # Run tests
    import sys
    print("Testing broken service...")
    try:
        import asyncio
        asyncio.run(test_broken_service_raises_type_error())
        print("✓ Broken service correctly raises error")
    except AssertionError as e:
        print(f"✗ Test failed: {e}")
        sys.exit(1)

    print("\nTesting fixed service...")
    try:
        asyncio.run(test_fixed_service_works())
        print("✓ Fixed service works without errors")
    except AssertionError as e:
        print(f"✗ Test failed: {e}")
        sys.exit(1)

    print("\nTesting fixed service with all parameters...")
    try:
        asyncio.run(test_fixed_service_with_priority_weights())
        print("✓ Fixed service works with priority_weights")
    except AssertionError as e:
        print(f"✗ Test failed: {e}")
        sys.exit(1)

    print("\n✅ All tests passed!")
