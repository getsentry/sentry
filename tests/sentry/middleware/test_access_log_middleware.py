import logging

import pytest
from django.conf.urls import url
from django.test import override_settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.testutils import APITestCase
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class DummyEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        return Response({"ok": True})


class DummyFailEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        raise Exception("this is bad yo")


class RateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(0, 1),
            RateLimitCategory.USER: RateLimit(0, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(0, 1),
        },
    }

    def get(self, request):
        return Response({"ok": True})


access_log_fields = (
    "method",
    "view",
    "response",
    "user_id",
    "is_app",
    "token_type",
    "organization_id",
    "auth_id",
    "path",
    "caller_ip",
    "user_agent",
    "rate_limited",
    "rate_limit_category",
    "request_duration_seconds",
)


urlpatterns = [
    url(r"^/dummy$", DummyEndpoint.as_view(), name="dummy-endpoint"),
    url(r"^/dummyfail$", DummyFailEndpoint.as_view(), name="dummy-fail-endpoint"),
    url(r"^/dummyratelimit$", RateLimitedEndpoint.as_view(), name="ratelimit-endpoint"),
]


@override_settings(ROOT_URLCONF="tests.sentry.middleware.test_access_log_middleware")
class LogCaptureAPITestCase(APITestCase):
    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog):
        self._caplog = caplog

    def assert_access_log_recorded(self):
        sentinel = object()
        for record in self._caplog.records:
            for field in access_log_fields:
                assert getattr(record, field, sentinel) != sentinel


class TestAccessLogRateLimited(LogCaptureAPITestCase):

    endpoint = "ratelimit-endpoint"

    def test_access_log_success(self):
        self._caplog.set_level(logging.INFO, logger="api.access")
        self.get_error_response(status_code=429)
        self.assert_access_log_recorded()


@override_settings(ROOT_URLCONF="tests.sentry.middleware.test_access_log_middleware")
class TestAccessLogSuccess(LogCaptureAPITestCase):

    endpoint = "dummy-endpoint"

    def test_access_log_success(self):
        self.get_success_response()
        self.assert_access_log_recorded()


@override_settings(ROOT_URLCONF="tests.sentry.middleware.test_access_log_middleware")
class TestAccessLogFail(LogCaptureAPITestCase):
    endpoint = "dummy-fail-endpoint"

    def test_access_log_fail(self):
        self.get_error_response(status_code=500)
        self.assert_access_log_recorded()
