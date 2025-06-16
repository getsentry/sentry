import logging
from collections.abc import Callable

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry import options

logger = logging.getLogger(__name__)


class ReportingEndpointMiddleware:
    """
    Add ReportingEndpoint header for Sentry staff users only.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]):
        self.get_response = get_response
        try:
            # Cache the option value during initialization to avoid DB access on every request
            self.reporting_endpoints_enabled = options.get(
                "issues.browser_reporting.reporting_endpoints_header_enabled"
            )
        except Exception:
            logger.warning("Failed to get reporting endpoints enabled option", exc_info=True)
            self.reporting_endpoints_enabled = False

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        response = self.get_response(request)
        if self.reporting_endpoints_enabled:
            # This will enable crashes, intervention and deprecation warnings
            # They always report to the default endpoint
            response["Reporting-Endpoints"] = (
                "default=https://sentry.my.sentry.io/api/0/reporting-api-experiment/"
            )
        return response
