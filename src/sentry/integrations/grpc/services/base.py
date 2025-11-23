"""Base servicer class for gRPC services with authentication."""

from collections.abc import Callable
from functools import wraps
from typing import TypeVar

import grpc
from django.conf import settings

from sentry.integrations.grpc.interceptors.auth import check_grpc_authentication

T = TypeVar("T")


class BaseGrpcServicer:
    """Base class for gRPC servicers with built-in authentication."""

    def _check_auth(self, context: grpc.ServicerContext) -> bool:
        """Check authentication and return True if authenticated."""
        # For development: allow unauthenticated requests by default
        # In production, set GRPC_REQUIRE_AUTH = True in settings
        require_auth = getattr(settings, "GRPC_REQUIRE_AUTH", False)
        if not require_auth:
            return True

        # Try to extract headers from the request if available
        request_headers = None
        # TODO: Extract headers from WSGI environ when grpcWSGI provides access

        return check_grpc_authentication(context, request_headers)

    @staticmethod
    def require_auth(method: Callable[..., T]) -> Callable[..., T]:
        """
        Decorator to require authentication for gRPC methods.

        Usage:
            @BaseGrpcServicer.require_auth
            def ListRepositories(self, request, context):
                ...
        """

        @wraps(method)
        def wrapper(self, request, context, *args, **kwargs):
            # Check authentication
            if not self._check_auth(context):
                # Return empty response of the expected type
                # The type is inferred from the method's return annotation
                return_type = method.__annotations__.get("return")
                if return_type:
                    try:
                        return return_type()
                    except Exception:
                        pass
                return None

            # Call the actual method
            return method(self, request, context, *args, **kwargs)

        return wrapper


def authenticated_method(func: Callable[..., T]) -> Callable[..., T]:
    """
    Standalone decorator for methods that require authentication.

    This can be used without inheriting from BaseGrpcServicer.
    """

    @wraps(func)
    def wrapper(self, request, context, *args, **kwargs):
        # Ensure the servicer has _check_auth method
        if not hasattr(self, "_check_auth"):
            raise AttributeError(
                f"Class {self.__class__.__name__} must have _check_auth method "
                "or inherit from BaseGrpcServicer"
            )

        # Check authentication
        if not self._check_auth(context):
            # Try to return empty response of expected type
            return_type = func.__annotations__.get("return")
            if return_type:
                try:
                    return return_type()
                except Exception:
                    pass
            return None

        return func(self, request, context, *args, **kwargs)

    return wrapper
