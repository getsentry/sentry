from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils import json


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Ensure that we have proper security headers set.
    """

    def process_response(self, request: Request, response: Response) -> Response:
        if not request.path.startswith("/extensions/jira/"):
            response.setdefault("X-Frame-Options", "deny")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("X-XSS-Protection", "1; mode=block")

        # Add COOP and Report-To headers if COOP_ENABLED
        if getattr(settings, "COOP_ENABLED", False):
            coop_report_to = getattr(settings, "COOP_REPORT_TO", None)

            coop_value = "same-origin"
            if coop_report_to:
                coop_value += '; report-to="coop-endpoint"'

            coop_header = "Cross-Origin-Opener-Policy-Report-Only"
            if not getattr(settings, "COOP_REPORT_ONLY", True):
                coop_header = "Cross-Origin-Opener-Policy"

            response[coop_header] = coop_value

            if coop_report_to:
                response["Report-To"] = json.dumps(
                    {
                        "group": "coop-endpoint",
                        "max_age": 86400,
                        "endpoints": [{"url": coop_report_to}],
                    }
                )

        return response
