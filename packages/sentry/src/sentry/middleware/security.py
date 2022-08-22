from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Ensure that we have proper security headers set.
    """

    def process_response(self, request: Request, response: Response) -> Response:
        response.setdefault("X-Frame-Options", "deny")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("X-XSS-Protection", "1; mode=block")
        return response
