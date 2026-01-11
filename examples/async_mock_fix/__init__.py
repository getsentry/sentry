"""
Example demonstrating the fix for:
HTTPException: object MagicMock can't be used in 'await' expression

This package contains:
- api_routes_networking.py: The FastAPI endpoint that requires async mocking
- test_networking_broken.py: Demonstrates the problem with MagicMock
- test_networking_fixed.py: Shows the correct solution using AsyncMock
- README.md: Comprehensive documentation of the issue and fix
"""

__all__ = [
    "NetworkingService",
    "router",
    "get_networking_service",
    "get_current_user",
]

from .api_routes_networking import (
    NetworkingService,
    router,
    get_networking_service,
    get_current_user,
)
