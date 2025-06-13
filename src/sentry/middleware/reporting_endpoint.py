from collections.abc import Callable

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry import options


class ReportingEndpointMiddleware:
    """
    Add ReportingEndpoint header for Sentry staff users only.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        response = self.get_response(request)
        return self.process_response(request, response)

    def process_response(
        self, request: HttpRequest, response: HttpResponseBase
    ) -> HttpResponseBase:
        if options.get("issues.browser_reporting.reporting_endpoints_header_enabled"):
            # This will enable crashes and intervention and deprecation reports
            # They always report to the default endpoint
            response["Reporting-Endpoints"] = (
                "default=https://sentry.my.sentry.io/api/0/reporting-api-experiment/"
            )
        return response
