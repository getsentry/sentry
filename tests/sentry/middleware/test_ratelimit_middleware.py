from unittest.mock import patch

from django.test import RequestFactory
from exam import fixture
from freezegun import freeze_time
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.middleware.ratelimit import RatelimitMiddleware
from sentry.testutils import TestCase
from sentry.types.ratelimit import RateLimit


class RatelimitMiddlewareTest(TestCase):
    middleware = fixture(RatelimitMiddleware)
    factory = fixture(RequestFactory)

    class TestEndpoint(Endpoint):
        def get(self):
            return Response({"ok": True})

    _test_endpoint = TestEndpoint.as_view()

    @patch("sentry.middleware.ratelimit.get_rate_limit_value")
    def test_positive_rate_limit_check(self, default_rate_limit_mock):
        request = self.factory.get("/")
        with freeze_time("2000-01-01"):
            default_rate_limit_mock.return_value = RateLimit(0, 100)
            self.middleware.process_view(request, self._test_endpoint, [], {})
            assert request.will_be_rate_limited

        with freeze_time("2000-01-02"):
            # 10th request in a 10 request window should get rate limited
            default_rate_limit_mock.return_value = RateLimit(10, 100)
            for _ in range(10):
                self.middleware.process_view(request, self._test_endpoint, [], {})
                assert not request.will_be_rate_limited

            self.middleware.process_view(request, self._test_endpoint, [], {})
            assert request.will_be_rate_limited

    @patch("sentry.middleware.ratelimit.get_rate_limit_value")
    def test_negative_rate_limit_check(self, default_rate_limit_mock):
        request = self.factory.get("/")
        default_rate_limit_mock.return_value = RateLimit(10, 100)
        self.middleware.process_view(request, self._test_endpoint, [], {})
        assert not request.will_be_rate_limited

        # Requests outside the current window should not be rate limited
        default_rate_limit_mock.return_value = RateLimit(1, 1)
        with freeze_time("2000-01-01") as frozen_time:
            self.middleware.process_view(request, self._test_endpoint, [], {})
            assert not request.will_be_rate_limited
            frozen_time.tick(1)
            self.middleware.process_view(request, self._test_endpoint, [], {})
            assert not request.will_be_rate_limited
