"""
Verification script to demonstrate the fix without requiring pytest.

This script shows:
1. The broken case (MagicMock with async) - demonstrates the error
2. The fixed case (AsyncMock) - shows it working correctly
"""
import asyncio
from unittest.mock import MagicMock, AsyncMock


class MockNetworkingService:
    """Service with an async method."""
    
    async def respond_to_request(self, user_id: str, request_id: str, accept: bool) -> dict:
        """Async method that needs proper mocking."""
        await asyncio.sleep(0.01)  # Simulate async operation
        return {
            "request_id": request_id,
            "status": "accepted" if accept else "rejected",
            "user_id": user_id
        }


async def endpoint_handler(service: MockNetworkingService, request_id: str, accept: bool) -> dict:
    """
    Simulates the FastAPI endpoint that was failing.
    This is the code at line 207 in the original error.
    """
    result = await service.respond_to_request(
        user_id="168366f4-bebc-4e65-a14f-725aec84554f",
        request_id=request_id,
        accept=accept
    )
    return {
        "success": True,
        "request_id": request_id,
        "message": "Request accepted" if accept else "Request declined"
    }


async def test_broken_magicmock():
    """
    ❌ BROKEN: This demonstrates the error.
    Using MagicMock for an async method causes TypeError.
    """
    print("\n" + "="*70)
    print("TEST 1: BROKEN - Using MagicMock for async method")
    print("="*70)
    
    # Create a MagicMock (WRONG approach)
    mock_service = MagicMock()
    mock_service.respond_to_request.return_value = {
        "request_id": "test-123",
        "status": "accepted",
        "user_id": "user-456"
    }
    
    try:
        # Try to call the endpoint
        result = await endpoint_handler(mock_service, "test-123", True)
        print("❌ UNEXPECTED: Test should have failed but passed!")
        print(f"   Result: {result}")
    except TypeError as e:
        print("✓ Expected error occurred:")
        print(f"   TypeError: {e}")
        print("   This is the error from the Sentry report!")
        return True
    
    return False


async def test_fixed_asyncmock():
    """
    ✅ FIXED: Using AsyncMock for async methods.
    This is the correct approach.
    """
    print("\n" + "="*70)
    print("TEST 2: FIXED - Using AsyncMock for async method")
    print("="*70)
    
    # Create a mock with AsyncMock for the async method (CORRECT approach)
    mock_service = MagicMock(spec=MockNetworkingService)
    mock_service.respond_to_request = AsyncMock(return_value={
        "request_id": "test-123",
        "status": "accepted",
        "user_id": "user-456"
    })
    
    try:
        # Call the endpoint
        result = await endpoint_handler(mock_service, "test-123", True)
        print("✓ Success! No TypeError occurred")
        print(f"   Result: {result}")
        print(f"   Message: {result['message']}")
        
        # Verify the mock was called
        mock_service.respond_to_request.assert_called_once_with(
            user_id="168366f4-bebc-4e65-a14f-725aec84554f",
            request_id="test-123",
            accept=True
        )
        print("✓ Mock assertions passed")
        return True
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


async def test_asyncmock_with_side_effect():
    """
    ✅ BONUS: AsyncMock with side effects (exception handling).
    """
    print("\n" + "="*70)
    print("TEST 3: BONUS - AsyncMock with side effect (exception)")
    print("="*70)
    
    # Create mock that raises an exception
    mock_service = MagicMock(spec=MockNetworkingService)
    mock_service.respond_to_request = AsyncMock(
        side_effect=ValueError("Request not found")
    )
    
    try:
        result = await endpoint_handler(mock_service, "invalid-id", True)
        print("❌ Should have raised an exception")
        return False
    except ValueError as e:
        print("✓ Exception handling works correctly")
        print(f"   ValueError: {e}")
        return True


async def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("DEMONSTRATING THE FIX FOR:")
    print("HTTPException: object MagicMock can't be used in 'await' expression")
    print("="*70)
    
    results = []
    
    # Test 1: Show the broken case
    results.append(await test_broken_magicmock())
    
    # Test 2: Show the fixed case
    results.append(await test_fixed_asyncmock())
    
    # Test 3: Show bonus features
    results.append(await test_asyncmock_with_side_effect())
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    passed = sum(results)
    total = len(results)
    print(f"Tests passed: {passed}/{total}")
    
    if all(results):
        print("\n✓ All tests passed!")
        print("\nKEY TAKEAWAY:")
        print("  - Use AsyncMock (not MagicMock) for async functions")
        print("  - AsyncMock is available in Python 3.8+")
        print("  - Import: from unittest.mock import AsyncMock")
    else:
        print("\n❌ Some tests failed")
    
    print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
