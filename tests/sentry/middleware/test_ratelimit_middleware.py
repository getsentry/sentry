from unittest.mock import patch

from django.test import RequestFactory
from exam import fixture
from freezegun import freeze_time

from sentry.api.base import Endpoint
from sentry.auth.access import from_request
from sentry.middleware.ratelimit import (
    RatelimitMiddleware,
    above_rate_limit_check,
    get_rate_limit_key,
)
from sentry.testutils import TestCase


class RatelimitMiddlewareTest(TestCase):
    middleware = fixture(RatelimitMiddleware)
    factory = fixture(RequestFactory)
    view = lambda x: None

    @patch("sentry.middleware.ratelimit.get_default_rate_limit")
    def test_positive_rate_limit_check(self, default_rate_limit_mock):
        request = self.factory.get("/")
        with freeze_time("2000-01-01"):
            default_rate_limit_mock.return_value = (0, 100)
            self.middleware.process_view(request, self.view, [], {})
            assert request.will_be_rate_limited

        with freeze_time("2000-01-02"):
            # 10th request in a 10 request window should get rate limited
            default_rate_limit_mock.return_value = (10, 100)
            for _ in range(10):
                self.middleware.process_view(request, self.view, [], {})
                assert not request.will_be_rate_limited

            self.middleware.process_view(request, self.view, [], {})
            assert request.will_be_rate_limited

    @patch("sentry.middleware.ratelimit.get_default_rate_limit")
    def test_negative_rate_limit_check(self, default_rate_limit_mock):
        request = self.factory.get("/")
        default_rate_limit_mock.return_value = (10, 100)
        self.middleware.process_view(request, self.view, [], {})
        assert not request.will_be_rate_limited

        # Requests outside the current window should not be rate limited
        default_rate_limit_mock.return_value = (1, 1)
        with freeze_time("2000-01-01") as frozen_time:
            self.middleware.process_view(request, self.view, [], {})
            assert not request.will_be_rate_limited
            frozen_time.tick(1)
            self.middleware.process_view(request, self.view, [], {})
            assert not request.will_be_rate_limited

    @patch("sentry.middleware.ratelimit.get_default_rate_limit")
    def test_above_rate_limit_check(self, default_rate_limit_mock):
        default_rate_limit_mock.return_value = (10, 100)

        return_val = above_rate_limit_check("foo")
        assert return_val == dict(is_limited=False, current=1, limit=10, window=100)

    def test_get_rate_limit_key(self):
        # Mock view class
        class OrganizationGroupIndexEndpoint(Endpoint):
            pass

        self.view = OrganizationGroupIndexEndpoint

        # Test for default IP
        request = self.factory.get("/")
        assert (
            get_rate_limit_key(self.view, request)
            == "ip:tests.sentry.middleware.test_ratelimit_middleware.OrganizationGroupIndexEndpoint:GET:127.0.0.1"
        )

        # Test for users
        request.session = {}
        request.user = self.user
        assert (
            get_rate_limit_key(self.view, request)
            == f"user:tests.sentry.middleware.test_ratelimit_middleware.OrganizationGroupIndexEndpoint:GET:{self.user.id}"
        )

        # Test for organization tokens (ie: sentry apps)
        request.access = from_request(request, self.organization)
        request.user = self.create_user(is_sentry_app=True)
        assert (
            get_rate_limit_key(self.view, request)
            == f"org:tests.sentry.middleware.test_ratelimit_middleware.OrganizationGroupIndexEndpoint:GET:{self.organization.id}"
        )
