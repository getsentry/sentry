"""Base servicer class for gRPC services with authentication."""

from collections.abc import Callable
from functools import wraps
from typing import TypeVar

import grpc

from sentry import options
from sentry.integrations.grpc.interceptors.auth import check_grpc_authentication

T = TypeVar("T")


class BaseGrpcServicer:
    """Base class for gRPC servicers with built-in authentication."""

    def _check_auth(self, context: grpc.ServicerContext) -> bool:
        """Check authentication and return True if authenticated."""
        # For development: allow unauthenticated requests by default
        # In production, set grpc.require_auth = True in settings
        require_auth = options.get("grpc.require_auth", False)

        if not require_auth:
            return True

        # Try to extract headers from the context
        # grpcWSGI stores headers in the context
        request_headers = {}
        try:
            # Check for environ first (our custom context)
            if hasattr(context, "environ") and context.environ:
                # If we have access to WSGI environ
                environ = context.environ
                # Extract HTTP headers from environ
                for key, value in environ.items():
                    if key.startswith("HTTP_"):
                        # Convert HTTP_X_GRPC_AUTH_TOKEN to x-grpc-auth-token
                        header_name = key[5:].replace("_", "-").lower()
                        request_headers[header_name] = value
            elif hasattr(context, "_request_headers"):
                # Some implementations store headers directly
                request_headers = context._request_headers
            elif hasattr(context, "invocation_metadata"):
                # Standard gRPC method - but grpcWSGI doesn't implement it
                try:
                    metadata = context.invocation_metadata()
                    if metadata:
                        request_headers = dict(metadata)
                except NotImplementedError:
                    # grpcWSGI doesn't implement this
                    pass
        except Exception as e:
            # If we can't get headers, authentication will fail
            import logging

            logger = logging.getLogger(__name__)
            logger.exception(f"Failed to extract headers: {e}")
            pass

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
                    return return_type()
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
                return return_type()

            return None

        return func(self, request, context, *args, **kwargs)

    return wrapper
