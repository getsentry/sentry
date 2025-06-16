from unittest.mock import Mock

from django.http import HttpResponse, HttpResponseBase
from django.test import RequestFactory

from sentry.middleware.reporting_endpoint import ReportingEndpointMiddleware
from sentry.testutils.cases import TestCase


class ReportingEndpointMiddlewareTestCase(TestCase):
    def setUp(self) -> None:
        self.middleware = ReportingEndpointMiddleware(lambda request: HttpResponse())
        self.factory = RequestFactory()

    def _no_header_set(self, result: HttpResponseBase) -> None:
        assert "Reporting-Endpoints" not in result

    def test_adds_header_for_staff_user(self) -> None:
        """Test that the ReportingEndpoint header is added when user is Sentry staff."""
        request = self.factory.get("/")

        # Mock staff object with is_active = True
        staff_mock = Mock()
        staff_mock.is_active = True
        setattr(request, "staff", staff_mock)

        response = HttpResponse()
        result = self.middleware.process_response(request, response)

        assert "Reporting-Endpoints" in result
        assert (
            result["Reporting-Endpoints"]
            == "default=https://sentry.my.sentry.io/api/0/reporting-api-experiment/"
        )

    def test_no_header_for_non_staff_user(self) -> None:
        """Test that the ReportingEndpoint header is not added when user is not Sentry staff."""
        request = self.factory.get("/")

        # Mock staff object with is_active = False
        staff_mock = Mock()
        staff_mock.is_active = False
        setattr(request, "staff", staff_mock)

        response = HttpResponse()
        result = self.middleware.process_response(request, response)

        self._no_header_set(result)

    def test_no_header_when_no_staff_attribute(self) -> None:
        """Test that the ReportingEndpoint header is not added when request has no staff attribute."""
        request = self.factory.get("/")

        # No staff attribute on request
        response = HttpResponse()
        result = self.middleware.process_response(request, response)

        self._no_header_set(result)

    def test_no_header_when_staff_is_none(self) -> None:
        """Test that the ReportingEndpoint header is not added when staff is None."""
        request = self.factory.get("/")
        setattr(request, "staff", None)

        response = HttpResponse()
        result = self.middleware.process_response(request, response)

        self._no_header_set(result)
