"""
Middleware for handling gRPC-Web requests.
"""

from django.utils.deprecation import MiddlewareMixin
from django.views.decorators.csrf import csrf_exempt


class GrpcWebMiddleware(MiddlewareMixin):
    """
    Middleware to handle gRPC-Web requests and bypass CSRF protection.

    gRPC-Web requests are identified by their content-type headers and
    should not be subject to CSRF protection as they use different
    authentication mechanisms (API keys, HMAC signatures).
    """

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Process the view and bypass CSRF for gRPC-Web requests."""
        # Check if this is a gRPC-Web request
        content_type = request.META.get("CONTENT_TYPE", "")

        # gRPC-Web uses these content types
        if any(
            ct in content_type
            for ct in [
                "application/grpc-web",
                "application/grpc-web+proto",
                "application/grpc-web+json",
                "application/grpc-web-text",
                "application/grpc-web-text+proto",
            ]
        ):
            # Mark the view as CSRF exempt
            request._dont_enforce_csrf_checks = True

        return None
