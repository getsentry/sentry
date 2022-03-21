from unittest.mock import patch

from django.test import RequestFactory
from exam import fixture

from sentry.middleware.stats import RequestTimingMiddleware, add_request_metric_tags
from sentry.testutils import TestCase
from sentry.testutils.helpers.faux import Mock


class RequestTimingMiddlewareTest(TestCase):
    middleware = fixture(RequestTimingMiddleware)
    factory = fixture(RequestFactory)

    @patch("sentry.utils.metrics.incr")
    def test_records_default_api_metrics(self, incr):
        request = self.factory.get("/")
        request._view_path = "/"
        response = Mock(status_code=200)

        self.middleware.process_response(request, response)

        incr.assert_called_with(
            "view.response",
            instance=request._view_path,
            tags={"method": "GET", "status_code": 200, "ui_request": False},
            skip_internal=False,
        )

    @patch("sentry.utils.metrics.incr")
    def test_records_ui_request(self, incr):
        request = self.factory.get("/")
        request._view_path = "/"
        response = Mock(status_code=200)
        request.COOKIES = {"foo": "bar"}

        self.middleware.process_response(request, response)

        incr.assert_called_with(
            "view.response",
            instance=request._view_path,
            tags={"method": "GET", "status_code": 200, "ui_request": True},
            skip_internal=False,
        )

    @patch("sentry.utils.metrics.incr")
    def test_records_endpoint_specific_metrics(self, incr):
        request = self.factory.get("/")
        request._view_path = "/"
        request._metric_tags = {"a": "b"}

        response = Mock(status_code=200)

        self.middleware.process_response(request, response)

        incr.assert_called_with(
            "view.response",
            instance=request._view_path,
            tags={"method": "GET", "status_code": 200, "ui_request": False, "a": "b"},
            skip_internal=False,
        )

    @patch("sentry.utils.metrics.incr")
    def test_add_request_metric_tags(self, incr):
        request = self.factory.get("/")
        request._view_path = "/"

        add_request_metric_tags(request, foo="bar")

        response = Mock(status_code=200)

        self.middleware.process_response(request, response)

        incr.assert_called_with(
            "view.response",
            instance=request._view_path,
            tags={"method": "GET", "status_code": 200, "ui_request": False, "foo": "bar"},
            skip_internal=False,
        )
