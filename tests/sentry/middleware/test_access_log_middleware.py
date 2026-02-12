import logging
from urllib.parse import unquote

import pytest
from django.http import HttpRequest
from django.test import override_settings
from django.urls import re_path, reverse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationEndpoint
from sentry.api.endpoints.internal.rpc import InternalRpcServiceEndpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.models.apitoken import ApiToken
from sentry.ratelimits.config import RateLimitConfig
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_APIGATEWAY_HEADER
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, control_silo_test
from sentry.types.ratelimit import RateLimit, RateLimitCategory, RateLimitMeta, RateLimitType
from sentry.utils.snuba import RateLimitExceeded


class ImpersonationTestMiddleware:
    """
    Test middleware that simulates user impersonation by setting request.actual_user.
    Reads the X-Impersonator-Id header and sets request.actual_user if present.
    This middleware should be placed before the access log middleware in tests.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest):
        # Check for impersonator ID in header
        impersonator_id = request.META.get("HTTP_X_IMPERSONATOR_ID")
        if impersonator_id:
            from sentry.users.services.user.service import user_service

            try:
                actual_user = user_service.get_user(user_id=int(impersonator_id))
                if actual_user:
                    request.actual_user = actual_user  # type: ignore[attr-defined]
            except (ValueError, TypeError):
                # Invalid user ID format, skip
                pass

        response = self.get_response(request)
        return response


class DummyEndpoint(Endpoint):
    permission_classes = (SentryIsAuthenticated,)

    def get(self, request):
        return Response({"ok": True})


class DummyFailEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        raise Exception("this is bad yo")


class SnubaRateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):

        # Rate limit middleware will set metadata to indicate the request is not limited by the endpoint itself
        request._request.rate_limit_metadata = RateLimitMeta(
            rate_limit_type=RateLimitType.NOT_LIMITED,
            concurrent_limit=123,
            concurrent_requests=1,
            reset_time=123,
            group="test_group",
            limit=123,
            window=123,
            current=1,
            remaining=122,
        )

        # However, snuba's 429 will be caught by the custom handler and raise an exception
        # with the snuba metadata
        raise RateLimitExceeded(
            "Query on could not be run due to allocation policies, ... 'rejection_threshold': 40, 'quota_used': 41, ...",
            policy="ConcurrentRateLimitAllocationPolicy",
            quota_used=41,
            rejection_threshold=40,
            quota_unit="no_units",
            storage_key="test_storage_key",
        )


class RateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        group="foo",
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=0, window=1),
                RateLimitCategory.USER: RateLimit(limit=0, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=0, window=1),
            },
        },
    )

    def get(self, request):
        raise NotImplementedError


class ConcurrentRateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        group="foo",
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=20, window=1, concurrent_limit=1),
                RateLimitCategory.USER: RateLimit(limit=20, window=1, concurrent_limit=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=20, window=1, concurrent_limit=1),
            },
        },
    )

    def get(self, request):
        return Response({"ok": True})


class MyOrganizationEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        return Response({"ok": True})


class MyControlOrganizationEndpoint(ControlSiloOrganizationEndpoint):
    def get(self, request, organization_context, organization):
        return Response({"ok": True})


urlpatterns = [
    re_path(r"^/dummy$", DummyEndpoint.as_view(), name="dummy-endpoint"),
    re_path(r"^api/0/internal/test$", DummyEndpoint.as_view(), name="internal-dummy-endpoint"),
    re_path(r"^/dummyfail$", DummyFailEndpoint.as_view(), name="dummy-fail-endpoint"),
    re_path(
        r"^snubaratelimit$", SnubaRateLimitedEndpoint.as_view(), name="snuba-ratelimit-endpoint"
    ),
    re_path(r"^/dummyratelimit$", RateLimitedEndpoint.as_view(), name="ratelimit-endpoint"),
    re_path(
        r"^/dummyratelimitconcurrent$",
        ConcurrentRateLimitedEndpoint.as_view(),
        name="concurrent-ratelimit-endpoint",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/stats_v2/$",
        MyOrganizationEndpoint.as_view(),
        name="sentry-api-0-organization-stats-v2",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/members/$",
        MyControlOrganizationEndpoint.as_view(),
        name="sentry-api-0-organization-members",
    ),
    # Need to retain RPC endpoint for cross-silo calls
    re_path(
        r"^api/0/internal/rpc/(?P<service_name>\w+)/(?P<method_name>\w+)/$",
        InternalRpcServiceEndpoint.as_view(),
        name="sentry-api-0-rpc-service",
    ),
]

required_access_log_fields = (
    "method",
    "view",
    "response",
    "path",
    "rate_limit_type",
    "rate_limited",
    "caller_ip",
    "request_duration_seconds",
)

# All of these fields may be None, and thus may not appear in every access log
optional_access_log_fields = (
    "organization_id",
    "is_app",
    "user_id",
    "impersonator_user_id",
    "token_type",
    "entity_id",
    "user_agent",
    "rate_limit_category",
    "group",
    "concurrent_limit",
    "concurrent_requests",
    "reset_time",
    "limit",
    "remaining",
    "snuba_policy",
    "snuba_quota_unit",
    "snuba_storage_key",
    "snuba_quota_used",
    "snuba_rejection_threshold",
    "token_last_characters",
    "gateway_proxy",
)


@override_settings(ROOT_URLCONF=__name__)
@override_settings(LOG_API_ACCESS=True)
@override_settings(
    MIDDLEWARE=[
        "tests.sentry.middleware.test_access_log_middleware.ImpersonationTestMiddleware",
        *[
            m
            for m in __import__("django.conf", fromlist=["settings"]).settings.MIDDLEWARE
            if "ImpersonationTestMiddleware" not in m
        ],
    ]
)
class LogCaptureAPITestCase(APITestCase):
    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog: pytest.LogCaptureFixture):
        self._caplog = caplog

    def assert_access_log_recorded(self):
        sentinel = object()
        for record in self.captured_logs:
            for field in required_access_log_fields:
                assert getattr(record, field, sentinel) != sentinel, field

    @property
    def captured_logs(self):
        return [r for r in self._caplog.records if r.name == "sentry.access.api"]

    def get_tested_log(self, **kwargs):
        tested_log_path = unquote(reverse(self.endpoint, **kwargs))
        return next(log for log in self.captured_logs if log.path == tested_log_path)


@all_silo_test
class TestAccessLogSnubaRateLimited(LogCaptureAPITestCase):
    endpoint = "snuba-ratelimit-endpoint"

    def test_access_log_snuba_rate_limited(self) -> None:
        """Test that Snuba rate limits are properly logged by access log middleware."""
        self._caplog.set_level(logging.INFO, logger="sentry")
        self.get_error_response(status_code=429)
        self.assert_access_log_recorded()

        assert self.captured_logs[0].rate_limit_type == "snuba"
        assert self.captured_logs[0].rate_limited == "True"

        # All the types from the standard rate limit metadata should be set
        assert self.captured_logs[0].remaining == "122"
        assert self.captured_logs[0].concurrent_limit == "123"
        assert self.captured_logs[0].concurrent_requests == "1"
        assert self.captured_logs[0].limit == "123"
        assert self.captured_logs[0].reset_time == "123"

        # Snuba rate limit specific fields should be set
        assert self.captured_logs[0].snuba_policy == "ConcurrentRateLimitAllocationPolicy"
        assert self.captured_logs[0].snuba_quota_unit == "no_units"
        assert self.captured_logs[0].snuba_storage_key == "test_storage_key"
        assert self.captured_logs[0].snuba_quota_used == "41"
        assert self.captured_logs[0].snuba_rejection_threshold == "40"


@all_silo_test
@override_settings(SENTRY_SELF_HOSTED=False)
class TestAccessLogRateLimited(LogCaptureAPITestCase):
    endpoint = "ratelimit-endpoint"

    def test_access_log_rate_limited(self) -> None:
        self._caplog.set_level(logging.INFO, logger="sentry")
        self.get_error_response(status_code=429)
        self.assert_access_log_recorded()
        # no token because the endpoint was not hit
        assert not hasattr(self.captured_logs[0], "token_type")
        assert self.captured_logs[0].limit == "0"
        assert self.captured_logs[0].remaining == "0"
        assert self.captured_logs[0].group == RateLimitedEndpoint.rate_limits.group


@all_silo_test
@override_settings(SENTRY_SELF_HOSTED=False)
class TestAccessLogConcurrentRateLimited(LogCaptureAPITestCase):
    endpoint = "concurrent-ratelimit-endpoint"

    def test_concurrent_request_finishes(self) -> None:
        self._caplog.set_level(logging.INFO, logger="sentry")
        for i in range(10):
            self.get_success_response()
        # these requests were done in succession, so we should not have any
        # rate limiting
        self.assert_access_log_recorded()
        for i in range(10):
            assert not hasattr(self.captured_logs[i], "token_type")
            assert self.captured_logs[0].group == RateLimitedEndpoint.rate_limits.group
            assert self.captured_logs[i].concurrent_requests == "1"
            assert self.captured_logs[i].concurrent_limit == "1"
            assert self.captured_logs[i].rate_limit_type == "not_limited"
            assert self.captured_logs[i].limit == "20"
            # we cannot assert on the exact amount of remaining requests because
            # we may be crossing a second boundary during our test. That would make things
            # flaky.
            assert int(self.captured_logs[i].remaining) < 20


@all_silo_test
class TestAccessLogSuccess(LogCaptureAPITestCase):
    endpoint = "dummy-endpoint"

    def test_access_log_success(self) -> None:
        self._caplog.set_level(logging.INFO, logger="sentry")
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.login_as(user=self.create_user())
        self.get_success_response(extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"})
        self.assert_access_log_recorded()
        tested_log = self.get_tested_log()
        assert tested_log.token_type == "api_token"
        assert tested_log.token_last_characters == token.token_last_characters
        assert tested_log.entity_id == str(token.id)

    def test_access_log_gateway_proxy(self) -> None:
        self._caplog.set_level(logging.INFO, logger="sentry")
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.login_as(user=self.create_user())
        upper_gateway_header = PROXY_APIGATEWAY_HEADER.upper().replace("-", "_")
        self.get_success_response(
            extra_headers={
                "HTTP_AUTHORIZATION": f"Bearer {token.token}",
                f"HTTP_{upper_gateway_header}": "true",
            }
        )
        self.assert_access_log_recorded()
        tested_log = self.get_tested_log()
        assert tested_log.gateway_proxy == "true"

    def test_with_subdomain_redirect(self) -> None:
        # the subdomain middleware is in between this and the access log middelware
        # meaning if a request is rejected between those then it will not have `auth`
        # set up properly
        # this previously logged an error to sentry
        resp = self.get_response(extra_headers={"HTTP_HOST": "invalid_domain.testserver"})
        assert resp.status_code == 302
        records = [record for record in self._caplog.records if record.levelno == logging.ERROR]
        assert not records  # no errors should occur

    def test_no_impersonation(self) -> None:
        """Test that impersonator_user_id is not present when there's no impersonation."""
        self._caplog.set_level(logging.INFO, logger="sentry")
        self.login_as(user=self.user)
        self.get_success_response()
        self.assert_access_log_recorded()

        tested_log = self.get_tested_log()
        assert not hasattr(tested_log, "impersonator_user_id")

    def test_with_impersonation(self) -> None:
        """Test that impersonator_user_id is logged when request.actual_user is set."""
        self._caplog.set_level(logging.INFO, logger="sentry")

        impersonated_user = self.create_user(email="impersonated@example.com")
        actual_user = self.create_user(email="actual@example.com")

        self.login_as(user=impersonated_user)

        # Pass impersonator ID via header - middleware will set request.actual_user
        response = self.client.get(
            reverse(self.endpoint), HTTP_X_IMPERSONATOR_ID=str(actual_user.id)
        )
        assert response.status_code == 200
        self.assert_access_log_recorded()

        tested_log = self.get_tested_log()
        assert tested_log.user_id == str(impersonated_user.id)
        assert tested_log.impersonator_user_id == str(actual_user.id)

    def test_impersonation_with_none_actual_user(self) -> None:
        """Test that impersonator_user_id is not present when actual_user is not set."""
        self._caplog.set_level(logging.INFO, logger="sentry")
        self.login_as(user=self.user)

        # No impersonation set (fixture clears it automatically)
        response = self.client.get(reverse(self.endpoint))
        assert response.status_code == 200
        self.assert_access_log_recorded()

        tested_log = self.get_tested_log()
        assert not hasattr(tested_log, "impersonator_user_id")

    def test_impersonation_tracks_correct_user_ids(self) -> None:
        """Test that both user_id and impersonator_user_id are correctly tracked."""
        self._caplog.set_level(logging.INFO, logger="sentry")

        impersonated_user = self.create_user(email="impersonated@example.com")
        actual_user = self.create_user(email="actual@example.com")

        self.login_as(user=impersonated_user)

        # Pass impersonator ID via header - middleware will set request.actual_user
        response = self.client.get(
            reverse(self.endpoint), HTTP_X_IMPERSONATOR_ID=str(actual_user.id)
        )
        assert response.status_code == 200
        self.assert_access_log_recorded()

        tested_log = self.get_tested_log()
        # Ensure the logged user is the impersonated user
        assert tested_log.user_id == str(impersonated_user.id)
        assert int(tested_log.user_id) != actual_user.id
        # Ensure the impersonator is the actual user
        assert tested_log.impersonator_user_id == str(actual_user.id)
        assert int(tested_log.impersonator_user_id) != impersonated_user.id


@all_silo_test
@override_settings(LOG_API_ACCESS=False)
class TestAccessLogSuccessNotLoggedInDev(LogCaptureAPITestCase):
    endpoint = "dummy-endpoint"

    def test_access_log_success(self) -> None:
        token = None
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.login_as(user=self.create_user())
        self.get_success_response(extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"})
        assert len(self.captured_logs) == 0


@all_silo_test
class TestAccessLogSkippedForExcludedPath(LogCaptureAPITestCase):
    endpoint = "internal-dummy-endpoint"

    def test_access_log_skipped(self) -> None:
        self._caplog.set_level(logging.INFO, logger="sentry")
        token = None
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.login_as(user=self.create_user())
        self.get_success_response(extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"})
        assert len(self.captured_logs) == 0


@all_silo_test
class TestAccessLogFail(LogCaptureAPITestCase):
    endpoint = "dummy-fail-endpoint"

    def test_access_log_fail(self) -> None:
        self.get_error_response(status_code=500)
        self.assert_access_log_recorded()


class TestOrganizationIdPresentForRegion(LogCaptureAPITestCase):
    endpoint = "sentry-api-0-organization-stats-v2"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_org_id_populated(self) -> None:
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

        tested_log = self.get_tested_log(args=[self.organization.slug])
        assert tested_log.organization_id == str(self.organization.id)


@control_silo_test
class TestOrganizationIdPresentForControl(LogCaptureAPITestCase):
    endpoint = "sentry-api-0-organization-members"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_org_id_populated(self) -> None:
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

        tested_log = self.get_tested_log(args=[self.organization.slug])
        assert tested_log.organization_id == str(self.organization.id)
