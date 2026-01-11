"""
Practical example of AsyncMock usage in a Sentry-style test.

This demonstrates how to properly test async service dependencies
in a way that could be integrated into the Sentry test suite.
"""
try:
    import pytest
    PYTEST_AVAILABLE = True
except ImportError:
    PYTEST_AVAILABLE = False
    # Create a dummy pytest.mark for when pytest is not available
    class _DummyMark:
        def asyncio(self, func):
            return func
    class _DummyPytest:
        mark = _DummyMark()
    pytest = _DummyPytest()

from unittest.mock import MagicMock, AsyncMock, patch
from typing import Optional


# Example: Testing an async integration service
class ExternalAPIService:
    """Simulates an external API service with async methods."""
    
    async def fetch_user_data(self, user_id: str) -> dict:
        """Fetch user data from external API."""
        # In real code, this would make an HTTP request
        raise NotImplementedError("Should be mocked in tests")
    
    async def update_user_status(self, user_id: str, status: str) -> bool:
        """Update user status via external API."""
        raise NotImplementedError("Should be mocked in tests")


class IntegrationHandler:
    """Handler that uses the external API service."""
    
    def __init__(self, service: ExternalAPIService):
        self.service = service
    
    async def process_user_request(self, user_id: str, action: str) -> dict:
        """Process a user request using the external service."""
        try:
            # Fetch current user data
            user_data = await self.service.fetch_user_data(user_id)
            
            # Update status based on action
            new_status = "active" if action == "activate" else "inactive"
            success = await self.service.update_user_status(user_id, new_status)
            
            return {
                "success": success,
                "user_id": user_id,
                "previous_status": user_data.get("status"),
                "new_status": new_status
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# ============================================================================
# TEST EXAMPLES
# ============================================================================

class TestIntegrationHandler:
    """Test suite demonstrating proper AsyncMock usage."""
    
    def test_process_user_request_success(self):
        """
        ✅ CORRECT: Using AsyncMock for async service methods.
        
        This test shows the proper way to mock async dependencies.
        """
        # Create mock service
        mock_service = MagicMock(spec=ExternalAPIService)
        
        # Mock async methods with AsyncMock
        mock_service.fetch_user_data = AsyncMock(return_value={
            "user_id": "user-123",
            "status": "inactive",
            "email": "user@example.com"
        })
        mock_service.update_user_status = AsyncMock(return_value=True)
        
        # Create handler with mocked service
        handler = IntegrationHandler(mock_service)
        
        # Run the async test
        import asyncio
        result = asyncio.run(handler.process_user_request("user-123", "activate"))
        
        # Assertions
        assert result["success"] is True
        assert result["user_id"] == "user-123"
        assert result["previous_status"] == "inactive"
        assert result["new_status"] == "active"
        
        # Verify mocks were called correctly
        mock_service.fetch_user_data.assert_called_once_with("user-123")
        mock_service.update_user_status.assert_called_once_with("user-123", "active")
    
    def test_process_user_request_with_api_error(self):
        """
        ✅ CORRECT: Using AsyncMock with side_effect for error handling.
        
        This demonstrates how to test error scenarios with AsyncMock.
        """
        # Create mock service
        mock_service = MagicMock(spec=ExternalAPIService)
        
        # Mock fetch to raise an exception
        mock_service.fetch_user_data = AsyncMock(
            side_effect=ConnectionError("API unavailable")
        )
        
        # Create handler
        handler = IntegrationHandler(mock_service)
        
        # Run test
        import asyncio
        result = asyncio.run(handler.process_user_request("user-123", "activate"))
        
        # Assertions
        assert result["success"] is False
        assert "API unavailable" in result["error"]
    
    def test_process_user_request_multiple_calls(self):
        """
        ✅ CORRECT: AsyncMock with multiple return values.
        
        Demonstrates using side_effect with a list of return values.
        """
        # Create mock service
        mock_service = MagicMock(spec=ExternalAPIService)
        
        # Mock with multiple return values
        mock_service.fetch_user_data = AsyncMock(side_effect=[
            {"user_id": "user-1", "status": "inactive"},
            {"user_id": "user-2", "status": "active"},
        ])
        mock_service.update_user_status = AsyncMock(return_value=True)
        
        # Create handler
        handler = IntegrationHandler(mock_service)
        
        # Run multiple times
        import asyncio
        result1 = asyncio.run(handler.process_user_request("user-1", "activate"))
        result2 = asyncio.run(handler.process_user_request("user-2", "deactivate"))
        
        # Assertions
        assert result1["previous_status"] == "inactive"
        assert result2["previous_status"] == "active"
        assert mock_service.fetch_user_data.await_count == 2


class TestAsyncMockFeatures:
    """Additional examples of AsyncMock features."""
    
    def test_await_count(self):
        """AsyncMock tracks how many times it was awaited."""
        mock_service = MagicMock(spec=ExternalAPIService)
        mock_service.fetch_user_data = AsyncMock(return_value={"status": "ok"})
        
        import asyncio
        asyncio.run(mock_service.fetch_user_data("user-1"))
        asyncio.run(mock_service.fetch_user_data("user-2"))
        
        assert mock_service.fetch_user_data.await_count == 2
    
    def test_await_args(self):
        """AsyncMock tracks arguments from each await call."""
        mock_service = MagicMock(spec=ExternalAPIService)
        mock_service.fetch_user_data = AsyncMock(return_value={"status": "ok"})
        
        import asyncio
        asyncio.run(mock_service.fetch_user_data("user-123"))
        
        # Check the arguments of the await call
        assert mock_service.fetch_user_data.await_args[0][0] == "user-123"
    
    def test_assert_awaited_once(self):
        """AsyncMock provides awaited-specific assertions."""
        mock_service = MagicMock(spec=ExternalAPIService)
        mock_service.fetch_user_data = AsyncMock(return_value={"status": "ok"})
        
        import asyncio
        asyncio.run(mock_service.fetch_user_data("user-123"))
        
        # AsyncMock-specific assertions
        mock_service.fetch_user_data.assert_awaited_once()
        mock_service.fetch_user_data.assert_awaited_once_with("user-123")


# ============================================================================
# PYTEST-ASYNC EXAMPLES (if pytest-asyncio is available)
# ============================================================================

class TestWithPytestAsync:
    """
    Examples using pytest-asyncio for cleaner async tests.
    
    Requires: pip install pytest-asyncio
    """
    
    @pytest.mark.asyncio
    async def test_with_pytest_asyncio(self):
        """
        ✅ Using pytest-asyncio for cleaner async test syntax.
        
        This is the recommended approach for async tests in pytest.
        """
        # Create mock service
        mock_service = MagicMock(spec=ExternalAPIService)
        mock_service.fetch_user_data = AsyncMock(return_value={
            "user_id": "user-123",
            "status": "inactive"
        })
        mock_service.update_user_status = AsyncMock(return_value=True)
        
        # Create handler
        handler = IntegrationHandler(mock_service)
        
        # Can use await directly in the test
        result = await handler.process_user_request("user-123", "activate")
        
        # Assertions
        assert result["success"] is True
        mock_service.fetch_user_data.assert_awaited_once_with("user-123")


# ============================================================================
# COMPARISON: BROKEN vs FIXED
# ============================================================================

class TestComparison:
    """Direct comparison of broken and fixed approaches."""
    
    def test_broken_approach_would_fail(self):
        """
        ❌ BROKEN: This shows what NOT to do.
        
        If you uncommented this code, it would fail with:
        TypeError: object dict can't be used in 'await' expression
        """
        # mock_service = MagicMock()
        # mock_service.fetch_user_data.return_value = {"status": "ok"}  # ❌ Not awaitable!
        # 
        # handler = IntegrationHandler(mock_service)
        # 
        # import asyncio
        # result = asyncio.run(handler.process_user_request("user-123", "activate"))
        # # ^ This would raise TypeError
        
        pass  # Keeping as documentation
    
    def test_fixed_approach_works(self):
        """
        ✅ FIXED: This is the correct approach.
        """
        mock_service = MagicMock()
        mock_service.fetch_user_data = AsyncMock(return_value={"status": "ok"})  # ✅ Awaitable!
        mock_service.update_user_status = AsyncMock(return_value=True)
        
        handler = IntegrationHandler(mock_service)
        
        import asyncio
        result = asyncio.run(handler.process_user_request("user-123", "activate"))
        
        assert result["success"] is True


if __name__ == "__main__":
    print("Running practical AsyncMock examples...")
    print("\nThese tests demonstrate proper async mocking patterns")
    print("that can be used in the Sentry test suite.\n")
    
    # Run tests
    test_suite = TestIntegrationHandler()
    
    print("✓ Running test_process_user_request_success...")
    test_suite.test_process_user_request_success()
    print("  Passed!\n")
    
    print("✓ Running test_process_user_request_with_api_error...")
    test_suite.test_process_user_request_with_api_error()
    print("  Passed!\n")
    
    print("✓ Running test_process_user_request_multiple_calls...")
    test_suite.test_process_user_request_multiple_calls()
    print("  Passed!\n")
    
    feature_tests = TestAsyncMockFeatures()
    
    print("✓ Running test_await_count...")
    feature_tests.test_await_count()
    print("  Passed!\n")
    
    print("✓ Running test_await_args...")
    feature_tests.test_await_args()
    print("  Passed!\n")
    
    print("✓ Running test_assert_awaited_once...")
    feature_tests.test_assert_awaited_once()
    print("  Passed!\n")
    
    comparison_tests = TestComparison()
    
    print("✓ Running test_fixed_approach_works...")
    comparison_tests.test_fixed_approach_works()
    print("  Passed!\n")
    
    print("="*70)
    print("All practical examples passed!")
    print("="*70)
