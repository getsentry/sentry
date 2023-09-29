from django.test import override_settings
from django.urls import re_path
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class RateLimitTestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(1, 100)}}

    def get(self, request):
        return Response({"ok": True})


class RateLimitEnforcedEndpoint(RateLimitTestEndpoint):
    enforce_rate_limit = True


class RateLimitUnenforcedEndpoint(RateLimitTestEndpoint):
    enforce_rate_limit = False


urlpatterns = [
    re_path(r"^/enforced$", RateLimitEnforcedEndpoint.as_view(), name="enforced-endpoint"),
    re_path(r"^/unenforced$", RateLimitUnenforcedEndpoint.as_view(), name="unenforced-endpoint"),
]


@override_settings(ROOT_URLCONF=__name__)
class EnforceRateLimitTest(APITestCase):
    endpoint = "enforced-endpoint"

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_enforced_rate_limit(self):
        """Endpoints with enforce_rate_limit enabled should result in 429s"""
        with freeze_time("2000-01-01"):
            self.get_success_response()
            self.get_error_response(status_code=status.HTTP_429_TOO_MANY_REQUESTS)


@override_settings(ROOT_URLCONF=__name__)
class UnEnforceRateLimitTest(APITestCase):
    endpoint = "unenforced-endpoint"

    def test_unenforced_rate_limit(self):
        """Endpoints with enforce_rate_limit disabled shouldn't reject requests"""
        with freeze_time("2000-01-01"):
            self.get_success_response()
            self.get_success_response()
