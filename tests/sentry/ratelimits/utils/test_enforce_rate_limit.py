from django.test import override_settings
from django.urls import re_path, reverse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.endpoints.internal import InternalRpcServiceEndpoint
from sentry.ratelimits.config import RateLimitConfig
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class RateLimitTestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=1, window=100)}}
    )

    def get(self, request: Request) -> Response:
        return Response({"ok": True})


class RateLimitEnforcedEndpoint(RateLimitTestEndpoint):
    enforce_rate_limit = True


class RateLimitUnenforcedEndpoint(RateLimitTestEndpoint):
    enforce_rate_limit = False


class UserAPISplitEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.USER: RateLimit(limit=10, window=100),
                RateLimitCategory.USER_API: RateLimit(limit=1, window=100),
            }
        }
    )

    def get(self, request: Request) -> Response:
        return Response({"ok": True})


urlpatterns = [
    re_path(r"^/enforced$", RateLimitEnforcedEndpoint.as_view(), name="enforced-endpoint"),
    re_path(r"^/unenforced$", RateLimitUnenforcedEndpoint.as_view(), name="unenforced-endpoint"),
    re_path(r"^/split$", UserAPISplitEndpoint.as_view(), name="split-endpoint"),
    # Creating an ApiToken drains an outbox that reverses this route.
    re_path(
        r"^rpc/(?P<service_name>\w+)/(?P<method_name>\w+)/$",
        InternalRpcServiceEndpoint.as_view(),
        name="sentry-api-0-rpc-service",
    ),
]


@override_settings(ROOT_URLCONF=__name__)
class EnforceRateLimitTest(APITestCase):
    endpoint = "enforced-endpoint"

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_enforced_rate_limit(self) -> None:
        """Endpoints with enforce_rate_limit enabled should result in 429s"""
        with freeze_time("2000-01-01"):
            self.get_success_response()
            self.get_error_response(status_code=status.HTTP_429_TOO_MANY_REQUESTS)


@override_settings(ROOT_URLCONF=__name__)
class UnEnforceRateLimitTest(APITestCase):
    endpoint = "unenforced-endpoint"

    def test_unenforced_rate_limit(self) -> None:
        """Endpoints with enforce_rate_limit disabled shouldn't reject requests"""
        with freeze_time("2000-01-01"):
            self.get_success_response()
            self.get_success_response()


@override_settings(ROOT_URLCONF=__name__, SENTRY_SELF_HOSTED=False)
class UserAPISplitRateLimitTest(APITestCase):
    endpoint = "split-endpoint"

    @override_options({"api.rate-limit.user-api-split-views": ["UserAPISplitEndpoint"]})
    def test_exhausting_the_token_bucket_leaves_the_session_alone(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["event:read"])
        url = reverse(self.endpoint)

        with freeze_time("2000-01-01"):
            assert (
                self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}").status_code == 200
            )
            assert (
                self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}").status_code == 429
            )

            self.login_as(self.user)
            assert self.client.get(url).status_code == 200
