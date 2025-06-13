from django.http import HttpResponse
from django.test import RequestFactory

from sentry.middleware.reporting_endpoint import ReportingEndpointMiddleware
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class ReportingEndpointMiddlewareTestCase(TestCase):
    def setUp(self) -> None:
        self.middleware = ReportingEndpointMiddleware(lambda request: HttpResponse())
        self.factory = RequestFactory()

    def test_obeys_option(self) -> None:
        with override_options(
            {"issues.browser_reporting.reporting_endpoints_header_enabled": True}
        ):
            request = self.factory.get("/")
            response = self.middleware.process_response(request, HttpResponse())

            assert (
                response.get("Reporting-Endpoints")
                == "default=https://sentry.my.sentry.io/api/0/reporting-api-experiment/"
            )

        with override_options(
            {"issues.browser_reporting.reporting_endpoints_header_enabled": False}
        ):
            request = self.factory.get("/")
            response = self.middleware.process_response(request, HttpResponse())

            assert response.get("Reporting-Endpoints") is None
