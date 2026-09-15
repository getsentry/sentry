import logging

from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils import json

logger = logging.getLogger(__name__)

TRUSTED_TYPES_HEADER = "Content-Security-Policy-Report-Only"

_warned_about_report_only_csp = False


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Ensure that we have proper security headers set.
    """

    def process_response(self, request: Request, response: Response) -> Response:
        if not request.path.startswith("/extensions/jira/"):
            response.setdefault("X-Frame-Options", "deny")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("X-XSS-Protection", "1; mode=block")

        self.add_trusted_types_header(response)

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

    def add_trusted_types_header(self, response: Response) -> None:
        if not getattr(settings, "TRUSTED_TYPES_ENABLED", False):
            return

        # This middleware runs before CSPMiddleware on the response path, and
        # django-csp bails when its header name is already set. So when the CSP is
        # itself report-only we would be dropping the entire CSP to deliver
        # Trusted Types, which is never worth it.
        if getattr(settings, "CSP_REPORT_ONLY", False):
            global _warned_about_report_only_csp
            if not _warned_about_report_only_csp:
                _warned_about_report_only_csp = True
                logger.warning(
                    "trusted_types.disabled_by_report_only_csp",
                    extra={"header": TRUSTED_TYPES_HEADER},
                )
            return

        if TRUSTED_TYPES_HEADER in response:
            return

        directives = ["require-trusted-types-for 'script'"]

        policies = getattr(settings, "TRUSTED_TYPES_POLICIES", None) or []
        if policies:
            directives.append("trusted-types " + " ".join(policies))

        report_uri = getattr(settings, "TRUSTED_TYPES_REPORT_URI", None)
        if report_uri:
            directives.append(f"report-uri {report_uri}")

        response[TRUSTED_TYPES_HEADER] = "; ".join(directives)
