from unittest.mock import patch

from django.http import HttpResponse
from django.test import RequestFactory

from sentry.middleware.reporting_endpoint import ReportingEndpointMiddleware
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class ReportingEndpointMiddlewareTestCase(TestCase):
    def setUp(self) -> None:
        self.factory = RequestFactory()

    def test_obeys_option_when_enabled(self) -> None:
        with override_options(
            {"issues.browser_reporting.reporting_endpoints_header_enabled": True}
        ):
            # Create middleware with option enabled
            middleware = ReportingEndpointMiddleware(lambda request: HttpResponse())
            request = self.factory.get("/")
            response = middleware(request)

            assert (
                response.get("Reporting-Endpoints")
                == "default=https://sentry.my.sentry.io/api/0/reporting-api-experiment/"
            )

    def test_obeys_option_when_disabled(self) -> None:
        with override_options(
            {"issues.browser_reporting.reporting_endpoints_header_enabled": False}
        ):
            # Create middleware with option disabled
            middleware = ReportingEndpointMiddleware(lambda _: HttpResponse())
            request = self.factory.get("/")
            response = middleware(request)

            assert response.get("Reporting-Endpoints") is None

    def test_handles_option_fetch_failure(self) -> None:
        with patch("sentry.middleware.reporting_endpoint.options.get") as mock_options_get:
            mock_options_get.side_effect = Exception("Database error")

            # Should handle the exception gracefully and default to disabled
            middleware = ReportingEndpointMiddleware(lambda _: HttpResponse())
            request = self.factory.get("/")
            response = middleware(request)

            assert response.get("Reporting-Endpoints") is None
