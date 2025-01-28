from functools import cached_property
from unittest.mock import Mock, patch, sentinel

from django.test import RequestFactory, override_settings
from rest_framework.permissions import AllowAny

from sentry.api.base import Endpoint
from sentry.middleware.ratelimit import RatelimitMiddleware
from sentry.middleware.stats import RequestTimingMiddleware
from sentry.testutils.cases import TestCase
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class RateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    enforce_rate_limit = True
    rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(limit=0, window=10)}}

    def get(self):
        raise NotImplementedError


class RequestTimingMiddlewareTest(TestCase):
    middleware = cached_property(RequestTimingMiddleware)

    @cached_property
    def factory(self):
        return RequestFactory()

    @patch("sentry.utils.metrics.incr")
    def test_records_default_api_metrics(self, incr):
        request = self.factory.get("/")
        request._view_path = "/"
        response = Mock(status_code=200)

        self.middleware.process_response(request, response)

        incr.assert_called_with(
            "view.response",
            instance=request._view_path,
            tags={
                "method": "GET",
                "status_code": 200,
                "ui_request": False,
                "rate_limit_type": None,
            },
            skip_internal=False,
        )

    @patch("sentry.utils.metrics.incr")
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_records_default_api_metrics_with_rate_limit_type(self, incr):
        rate_limit_middleware = RatelimitMiddleware(sentinel.callback)
        test_endpoint = RateLimitedEndpoint.as_view()
        request = self.factory.get("/")
        request._view_path = "/"
        response = Mock(status_code=429)

        rate_limit_middleware.process_view(request, test_endpoint, [], {})
        self.middleware.process_response(request, response)

        incr.assert_called_with(
            "view.response",
            instance=request._view_path,
            tags={
                "method": "GET",
                "status_code": 429,
                "ui_request": False,
                "rate_limit_type": "fixed_window",
            },
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
            tags={"method": "GET", "status_code": 200, "ui_request": True, "rate_limit_type": None},
            skip_internal=False,
        )
