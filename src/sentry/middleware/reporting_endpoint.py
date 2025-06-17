from collections.abc import Callable

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase


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
        # Check if the request has staff attribute and if staff is active
        staff = getattr(request, "staff", None)
        if staff and staff.is_active:
            # This will enable crashes, intervention and deprecation warnings
            # They always report to the default endpoint
            response["Reporting-Endpoints"] = (
                "default=https://sentry.my.sentry.io/api/0/reporting-api-experiment/"
            )
        return response
