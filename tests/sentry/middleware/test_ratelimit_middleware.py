from concurrent.futures import ThreadPoolExecutor
from functools import cached_property
from time import sleep, time
from unittest.mock import patch, sentinel

from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from django.test import RequestFactory, override_settings
from django.urls import re_path, reverse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.endpoints.organization_group_index import OrganizationGroupIndexEndpoint
from sentry.middleware.ratelimit import RatelimitMiddleware
from sentry.models.apikey import ApiKey
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.user import User
from sentry.ratelimits.config import RateLimitConfig, get_default_rate_limits_for_group
from sentry.ratelimits.utils import get_rate_limit_config, get_rate_limit_key, get_rate_limit_value
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, BaseTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@all_silo_test
@override_settings(SENTRY_SELF_HOSTED=False)
class RatelimitMiddlewareTest(TestCase, BaseTestCase):
    middleware = RatelimitMiddleware(lambda request: sentinel.response)

    @cached_property
    def factory(self):
        return RequestFactory()

    class TestEndpoint(Endpoint):
        def get(self):
            return Response({"ok": True})

    _test_endpoint = TestEndpoint.as_view()

    def populate_sentry_app_request(self, request):
        install = self.create_sentry_app_installation(organization=self.organization)

        token = install.api_token

        with assume_test_silo_mode(SiloMode.CONTROL):
            request.user = User.objects.get(id=install.sentry_app.proxy_user_id)
        request.auth = token

    def populate_internal_integration_request(self, request):
        internal_integration = self.create_internal_integration(
            name="my_app",
            organization=self.organization,
            scopes=("project:read",),
            webhook_url="http://example.com",
        )
        # there should only be one record created so just grab the first one
        token = None
        with assume_test_silo_mode(SiloMode.CONTROL):
            install = SentryAppInstallation.objects.get(
                sentry_app=internal_integration.id, organization_id=self.organization.id
            )
            token = install.api_token

        assert token is not None

        with assume_test_silo_mode(SiloMode.CONTROL):
            request.user = User.objects.get(id=internal_integration.proxy_user_id)
        request.auth = token

    @patch("sentry.middleware.ratelimit.get_rate_limit_value", side_effect=Exception)
    def test_fails_open(self, default_rate_limit_mock):
        """Test that if something goes wrong in the rate limit middleware,
        the request still goes through"""
        request = self.factory.get("/")
        with freeze_time("2000-01-01"):
            default_rate_limit_mock.return_value = RateLimit(0, 100)
            self.middleware.process_view(request, self._test_endpoint, [], {})

    def test_process_response_fails_open(self):
        request = self.factory.get("/")
        bad_response = sentinel.response
        assert self.middleware.process_response(request, bad_response) is bad_response

        class BadRequest(HttpRequest):
            def __getattr__(self, attr):
                raise Exception("nope")

        bad_request = BadRequest()
        assert self.middleware.process_response(bad_request, bad_response) is bad_response

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
    def test_positive_rate_limit_response_headers(self, default_rate_limit_mock):
        request = self.factory.get("/")

        with freeze_time("2000-01-01"), patch.object(
            RatelimitMiddlewareTest.TestEndpoint, "enforce_rate_limit", True
        ):
            default_rate_limit_mock.return_value = RateLimit(0, 100)
            response = self.middleware.process_view(request, self._test_endpoint, [], {})
            assert request.will_be_rate_limited
            assert response
            assert response["Access-Control-Allow-Methods"] == "GET"
            assert response["Access-Control-Allow-Origin"] == "*"
            assert response["Access-Control-Allow-Headers"]
            assert response["Access-Control-Expose-Headers"]

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
            frozen_time.shift(1)
            self.middleware.process_view(request, self._test_endpoint, [], {})
            assert not request.will_be_rate_limited

    @patch("sentry.middleware.ratelimit.get_rate_limit_value")
    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_self_hosted_rate_limit_check(self, default_rate_limit_mock):
        """Check that for self hosted installs we don't rate limit"""
        request = self.factory.get("/")
        default_rate_limit_mock.return_value = RateLimit(10, 100)
        self.middleware.process_view(request, self._test_endpoint, [], {})
        assert not request.will_be_rate_limited

        default_rate_limit_mock.return_value = RateLimit(1, 1)
        with freeze_time("2000-01-01") as frozen_time:
            self.middleware.process_view(request, self._test_endpoint, [], {})
            assert not request.will_be_rate_limited
            frozen_time.shift(1)
            self.middleware.process_view(request, self._test_endpoint, [], {})
            assert not request.will_be_rate_limited

    def test_rate_limit_category(self):
        request = self.factory.get("/")
        request.META["REMOTE_ADDR"] = None
        self.middleware.process_view(request, self._test_endpoint, [], {})
        assert request.rate_limit_category is None

        request = self.factory.get("/")
        self.middleware.process_view(request, self._test_endpoint, [], {})
        assert request.rate_limit_category == RateLimitCategory.IP

        request.session = {}
        request.user = self.user
        self.middleware.process_view(request, self._test_endpoint, [], {})
        assert request.rate_limit_category == RateLimitCategory.USER

        self.populate_sentry_app_request(request)
        self.middleware.process_view(request, self._test_endpoint, [], {})
        assert request.rate_limit_category == RateLimitCategory.ORGANIZATION

        self.populate_internal_integration_request(request)
        self.middleware.process_view(request, self._test_endpoint, [], {})
        assert request.rate_limit_category == RateLimitCategory.ORGANIZATION

    def test_get_rate_limit_key(self):
        # Import an endpoint

        view = OrganizationGroupIndexEndpoint.as_view()
        rate_limit_config = get_rate_limit_config(view.view_class)
        rate_limit_group = rate_limit_config.group if rate_limit_config else RateLimitConfig().group

        # Test for default IP
        request = self.factory.get("/")
        assert (
            get_rate_limit_key(view, request, rate_limit_group, rate_limit_config)
            == "ip:default:OrganizationGroupIndexEndpoint:GET:127.0.0.1"
        )
        # Test when IP address is missing
        request.META["REMOTE_ADDR"] = None
        assert get_rate_limit_key(view, request, rate_limit_group, rate_limit_config) is None

        # Test when IP addess is IPv6
        request.META["REMOTE_ADDR"] = "684D:1111:222:3333:4444:5555:6:77"
        assert (
            get_rate_limit_key(view, request, rate_limit_group, rate_limit_config)
            == "ip:default:OrganizationGroupIndexEndpoint:GET:684D:1111:222:3333:4444:5555:6:77"
        )

        # Test for users
        request.session = {}
        request.user = self.user
        assert (
            get_rate_limit_key(view, request, rate_limit_group, rate_limit_config)
            == f"user:default:OrganizationGroupIndexEndpoint:GET:{self.user.id}"
        )

        # Test for user auth tokens
        token = self.create_user_auth_token(user=self.user, scope_list=["event:read", "org:read"])
        request.auth = token
        request.user = self.user
        assert (
            get_rate_limit_key(view, request, rate_limit_group, rate_limit_config)
            == f"user:default:OrganizationGroupIndexEndpoint:GET:{self.user.id}"
        )

        # Test for sentryapp auth tokens:
        self.populate_sentry_app_request(request)
        assert (
            get_rate_limit_key(view, request, rate_limit_group, rate_limit_config)
            == f"org:default:OrganizationGroupIndexEndpoint:GET:{self.organization.id}"
        )

        self.populate_internal_integration_request(request)
        assert (
            get_rate_limit_key(view, request, rate_limit_group, rate_limit_config)
            == f"org:default:OrganizationGroupIndexEndpoint:GET:{self.organization.id}"
        )

        # Test for
        request.user = AnonymousUser()
        api_key = None
        with assume_test_silo_mode(SiloMode.CONTROL):
            api_key = ApiKey.objects.create(
                organization_id=self.organization.id, scope_list=["project:write"]
            )
        request.auth = api_key
        assert (
            get_rate_limit_key(view, request, rate_limit_group, rate_limit_config)
            == "ip:default:OrganizationGroupIndexEndpoint:GET:684D:1111:222:3333:4444:5555:6:77"
        )


@override_settings(SENTRY_SELF_HOSTED=False)
class TestGetRateLimitValue(TestCase):
    def test_default_rate_limit_values(self):
        """Ensure that the default rate limits are called for endpoints without overrides"""

        class TestEndpoint(Endpoint):
            pass

        view = TestEndpoint.as_view()
        rate_limit_config = get_rate_limit_config(view.view_class)

        assert get_rate_limit_value(
            "GET", RateLimitCategory.IP, rate_limit_config
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.IP)
        assert get_rate_limit_value(
            "POST", RateLimitCategory.ORGANIZATION, rate_limit_config
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.ORGANIZATION)
        assert get_rate_limit_value(
            "DELETE", RateLimitCategory.USER, rate_limit_config
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.USER)

    def test_override_rate_limit(self):
        """Override one or more of the default rate limits"""

        class TestEndpoint(Endpoint):
            rate_limits = {
                "GET": {RateLimitCategory.IP: RateLimit(100, 5)},
                "POST": {RateLimitCategory.USER: RateLimit(20, 4)},
            }

        view = TestEndpoint.as_view()
        rate_limit_config = get_rate_limit_config(view.view_class)

        assert get_rate_limit_value("GET", RateLimitCategory.IP, rate_limit_config) == RateLimit(
            100, 5
        )
        # get is not overriddent for user, hence we use the default
        assert get_rate_limit_value(
            "GET", RateLimitCategory.USER, rate_limit_config
        ) == get_default_rate_limits_for_group("default", category=RateLimitCategory.USER)
        # get is not overriddent for IP, hence we use the default
        assert get_rate_limit_value(
            "POST", RateLimitCategory.IP, rate_limit_config
        ) == get_default_rate_limits_for_group("default", category=RateLimitCategory.IP)
        assert get_rate_limit_value("POST", RateLimitCategory.USER, rate_limit_config) == RateLimit(
            20, 4
        )


class RateLimitHeaderTestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    enforce_rate_limit = True
    rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(2, 100)}}

    def inject_call(self):
        return

    def get(self, request):
        self.inject_call()
        return Response({"ok": True})


class RaceConditionEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    enforce_rate_limit = False
    rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(40, 100)}}

    def get(self, request):
        return Response({"ok": True})


CONCURRENT_RATE_LIMIT = 3
CONCURRENT_ENDPOINT_DURATION = 0.2


class ConcurrentRateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        group="foo",
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
                RateLimitCategory.USER: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
                RateLimitCategory.ORGANIZATION: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
            },
        },
    )

    def get(self, request):
        sleep(CONCURRENT_ENDPOINT_DURATION)
        return Response({"ok": True})


class CallableRateLimitConfigEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True

    def rate_limits(request):
        return {
            "GET": {
                RateLimitCategory.IP: RateLimit(20, 1),
                RateLimitCategory.USER: RateLimit(20, 1),
                RateLimitCategory.ORGANIZATION: RateLimit(20, 1),
            },
        }

    def get(self, request):
        return Response({"ok": True})


urlpatterns = [
    re_path(
        r"^/ratelimit$", RateLimitHeaderTestEndpoint.as_view(), name="ratelimit-header-endpoint"
    ),
    re_path(r"^/race-condition$", RaceConditionEndpoint.as_view(), name="race-condition-endpoint"),
    re_path(r"^/concurrent$", ConcurrentRateLimitedEndpoint.as_view(), name="concurrent-endpoint"),
    re_path(
        r"^/callable-config$",
        CallableRateLimitConfigEndpoint.as_view(),
        name="callable-config-endpoint",
    ),
]


@override_settings(
    ROOT_URLCONF="tests.sentry.middleware.test_ratelimit_middleware", SENTRY_SELF_HOSTED=False
)
class TestRatelimitHeader(APITestCase):

    endpoint = "ratelimit-header-endpoint"

    def test_header_counts(self):
        """Ensure that the header remainder counts decrease properly"""
        with freeze_time("2000-01-01"):
            expected_reset_time = int(time() + 100)
            response = self.get_success_response()
            assert int(response["X-Sentry-Rate-Limit-Remaining"]) == 1
            assert int(response["X-Sentry-Rate-Limit-Limit"]) == 2
            assert int(response["X-Sentry-Rate-Limit-Reset"]) == expected_reset_time

            response = self.get_success_response()
            assert int(response["X-Sentry-Rate-Limit-Remaining"]) == 0
            assert int(response["X-Sentry-Rate-Limit-Limit"]) == 2
            assert int(response["X-Sentry-Rate-Limit-Reset"]) == expected_reset_time

            response = self.get_error_response()
            assert int(response["X-Sentry-Rate-Limit-Remaining"]) == 0
            assert int(response["X-Sentry-Rate-Limit-Limit"]) == 2
            assert int(response["X-Sentry-Rate-Limit-Reset"]) == expected_reset_time

            response = self.get_error_response()
            assert int(response["X-Sentry-Rate-Limit-Remaining"]) == 0
            assert int(response["X-Sentry-Rate-Limit-Limit"]) == 2
            assert int(response["X-Sentry-Rate-Limit-Reset"]) == expected_reset_time

    @patch("sentry.middleware.ratelimit.get_rate_limit_key")
    def test_omit_header(self, can_be_ratelimited_patch):
        """
        Ensure that functions that can't be rate limited don't have rate limit headers

        These functions include, but are not limited to:
            - UI Statistics Endpoints
            - Endpoints that don't inherit api.base.Endpoint
        """
        can_be_ratelimited_patch.return_value = None
        response = self.get_response()
        assert not response.has_header("X-Sentry-Rate-Limit-Remaining")
        assert not response.has_header("X-Sentry-Rate-Limit-Limit")
        assert not response.has_header("X-Sentry-Rate-Limit-Reset")

    def test_header_race_condition(self):
        """Make sure concurrent requests don't affect each other's rate limit"""

        def parallel_request(*args, **kwargs):
            self.client.get(reverse("race-condition-endpoint"))

        with patch.object(
            RateLimitHeaderTestEndpoint,
            "inject_call",
            parallel_request,
        ):
            response = self.get_success_response()

        assert int(response["X-Sentry-Rate-Limit-Remaining"]) == 1
        assert int(response["X-Sentry-Rate-Limit-Limit"]) == 2


@override_settings(
    ROOT_URLCONF="tests.sentry.middleware.test_ratelimit_middleware", SENTRY_SELF_HOSTED=False
)
class TestConcurrentRateLimiter(APITestCase):
    endpoint = "concurrent-endpoint"

    def test_request_finishes(self):
        # the endpoint in question has a concurrent rate limit of 3
        # since it is called one after the other, the remaining concurrent
        # requests should stay the same

        # if the middleware did not call finish_request() then the second request
        # would have a lower remaining concurrent request count
        for _ in range(2):
            response = self.get_success_response()
            assert (
                int(response["X-Sentry-Rate-Limit-ConcurrentRemaining"])
                == CONCURRENT_RATE_LIMIT - 1
            )
            assert int(response["X-Sentry-Rate-Limit-ConcurrentLimit"]) == CONCURRENT_RATE_LIMIT

    def test_concurrent_request_rate_limiting(self):
        """test the concurrent rate limiter end to-end"""
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            # dispatch more simultaneous requests to the endpoint than the concurrent limit
            for _ in range(CONCURRENT_RATE_LIMIT + 1):
                # sleep a little in between each submission
                # NOTE: This should not be necesary if the lua scripts are atomic
                # There is a test that does this with just the concurrent rate limiter
                # (test_redis_concurrent.py) and it doesn't need the sleep in between.
                # something about the test infra makes it so that if that sleep
                # is removed, the middleware is actually called double the amount of times
                # if you want to try and figure it out, please do so but I won't
                # - Volo
                sleep(0.01)
                futures.append(executor.submit(self.get_response))
            results = []
            for f in futures:
                results.append(f.result())

            limits = sorted(int(r["X-Sentry-Rate-Limit-ConcurrentRemaining"]) for r in results)
            # last two requests will have 0 concurrent slots remaining
            assert limits == [0, 0, *range(1, CONCURRENT_RATE_LIMIT)]
            sleep(CONCURRENT_ENDPOINT_DURATION + 0.1)
            response = self.get_success_response()
            assert (
                int(response["X-Sentry-Rate-Limit-ConcurrentRemaining"])
                == CONCURRENT_RATE_LIMIT - 1
            )


@override_settings(
    ROOT_URLCONF="tests.sentry.middleware.test_ratelimit_middleware", SENTRY_SELF_HOSTED=False
)
class TestCallableRateLimitConfig(APITestCase):
    endpoint = "callable-config-endpoint"

    def test_request_finishes(self):
        response = self.get_success_response()
        assert int(response["X-Sentry-Rate-Limit-Remaining"]) == 19
        assert int(response["X-Sentry-Rate-Limit-Limit"]) == 20
