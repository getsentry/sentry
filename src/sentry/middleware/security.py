from django.utils.deprecation import MiddlewareMixin


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Ensure that we have proper security headers set.
    """

    def process_response(self, request, response):
        response.setdefault("X-Frame-Options", "deny")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("X-XSS-Protection", "1; mode=block")
        return response
