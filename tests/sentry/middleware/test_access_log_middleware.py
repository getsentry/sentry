import logging

import pytest
from django.conf.urls import url
from django.test import override_settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import ApiToken
from sentry.ratelimits.config import RateLimitConfig
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test, region_silo_test
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class DummyEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response({"ok": True})


class DummyFailEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        raise Exception("this is bad yo")


class RateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        group="foo",
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(0, 1),
                RateLimitCategory.USER: RateLimit(0, 1),
                RateLimitCategory.ORGANIZATION: RateLimit(0, 1),
            },
        },
    )

    def get(self, request):
        return Response({"ok": True})


class ConcurrentRateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        group="foo",
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(20, 1, 1),
                RateLimitCategory.USER: RateLimit(20, 1, 1),
                RateLimitCategory.ORGANIZATION: RateLimit(20, 1, 1),
            },
        },
    )

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
    "group",
    "rate_limit_type",
    "concurrent_limit",
    "concurrent_requests",
    "reset_time",
    "limit",
    "remaining",
)


class MyOrganizationEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        return Response({"ok": True})


urlpatterns = [
    url(r"^/dummy$", DummyEndpoint.as_view(), name="dummy-endpoint"),
    url(r"^/dummyfail$", DummyFailEndpoint.as_view(), name="dummy-fail-endpoint"),
    url(r"^/dummyratelimit$", RateLimitedEndpoint.as_view(), name="ratelimit-endpoint"),
    url(
        r"^/dummyratelimitconcurrent$",
        ConcurrentRateLimitedEndpoint.as_view(),
        name="concurrent-ratelimit-endpoint",
    ),
    url(
        r"^(?P<organization_slug>[^\/]+)/stats_v2/$",
        MyOrganizationEndpoint.as_view(),
        name="sentry-api-0-organization-stats-v2",
    ),
]


@override_settings(ROOT_URLCONF="tests.sentry.middleware.test_access_log_middleware")
@override_settings(LOG_API_ACCESS=True)
class LogCaptureAPITestCase(APITestCase):
    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog):
        self._caplog = caplog

    def assert_access_log_recorded(self):
        sentinel = object()
        for record in self.captured_logs:
            for field in access_log_fields:
                assert getattr(record, field, sentinel) != sentinel, field

    @property
    def captured_logs(self):
        return [r for r in self._caplog.records if r.name == "sentry.access.api"]


@override_settings(SENTRY_SELF_HOSTED=False)
class TestAccessLogRateLimited(LogCaptureAPITestCase):

    endpoint = "ratelimit-endpoint"

    def test_access_log_rate_limited(self):
        self._caplog.set_level(logging.INFO, logger="sentry")
        self.get_error_response(status_code=429)
        self.assert_access_log_recorded()
        # no token because the endpoint was not hit
        assert self.captured_logs[0].token_type == "None"
        assert self.captured_logs[0].limit == "0"
        assert self.captured_logs[0].remaining == "0"
        assert self.captured_logs[0].group == RateLimitedEndpoint.rate_limits.group


@override_settings(SENTRY_SELF_HOSTED=False)
class TestAccessLogConcurrentRateLimited(LogCaptureAPITestCase):

    endpoint = "concurrent-ratelimit-endpoint"

    def test_concurrent_request_finishes(self):
        self._caplog.set_level(logging.INFO, logger="sentry")
        for i in range(10):
            self.get_success_response()
        # these requests were done in succession, so we should not have any
        # rate limiting
        self.assert_access_log_recorded()
        for i in range(10):
            assert self.captured_logs[i].token_type == "None"
            assert self.captured_logs[0].group == RateLimitedEndpoint.rate_limits.group
            assert self.captured_logs[i].concurrent_requests == "1"
            assert self.captured_logs[i].concurrent_limit == "1"
            assert self.captured_logs[i].rate_limit_type == "RateLimitType.NOT_LIMITED"
            assert self.captured_logs[i].limit == "20"
            # we cannot assert on the exact amount of remaining requests because
            # we may be crossing a second boundary during our test. That would make things
            # flaky.
            assert int(self.captured_logs[i].remaining) < 20


@control_silo_test
class TestAccessLogSuccess(LogCaptureAPITestCase):

    endpoint = "dummy-endpoint"

    def test_access_log_success(self):
        self._caplog.set_level(logging.INFO, logger="sentry")
        token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.login_as(user=self.create_user())
        self.get_success_response(extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"})
        self.assert_access_log_recorded()
        assert self.captured_logs[0].token_type == "ApiToken"


@override_settings(LOG_API_ACCESS=False)
@control_silo_test
class TestAccessLogSuccessNotLoggedInDev(LogCaptureAPITestCase):

    endpoint = "dummy-endpoint"

    def test_access_log_success(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.login_as(user=self.create_user())
        self.get_success_response(extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"})
        assert len(self.captured_logs) == 0


class TestAccessLogFail(LogCaptureAPITestCase):
    endpoint = "dummy-fail-endpoint"

    def test_access_log_fail(self):
        self.get_error_response(status_code=500)
        self.assert_access_log_recorded()


@region_silo_test
class TestOrganizationIdPresent(LogCaptureAPITestCase):
    endpoint = "sentry-api-0-organization-stats-v2"

    def setUp(self):
        self.login_as(user=self.user)

    def test_org_id_populated(self):
        self._caplog.set_level(logging.INFO, logger="sentry")
        self.get_success_response(
            self.organization.slug,
            qs_params={
                "project": [-1],
                "category": ["error"],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
            },
        )

        assert self.captured_logs[0].organization_id == str(self.organization.id)
