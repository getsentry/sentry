class SecurityHeadersMiddleware:
    """
    Ensure that we have proper security headers set
    """

    def process_response(self, request, response):
        # NOTE: there is no `response.setdefault()`
        if "X-Frame-Options" not in response:
            response["X-Frame-Options"] = "deny"
        if "X-Content-Type-Options" not in response:
            response["X-Content-Type-Options"] = "nosniff"
        if "X-XSS-Protection" not in response:
            response["X-XSS-Protection"] = "1; mode=block"
        return response
