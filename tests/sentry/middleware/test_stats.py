from __future__ import absolute_import

from django.test import RequestFactory
from exam import fixture
from sentry.utils.compat.mock import patch

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
            tags={"method": "GET", "status_code": 200},
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
            tags={"method": "GET", "status_code": 200, "a": "b"},
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
            tags={"method": "GET", "status_code": 200, "foo": "bar"},
            skip_internal=False,
        )
