from django.conf.urls import url
from django.test import override_settings
from freezegun import freeze_time
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.testutils import APITestCase
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class RateLimitEnforcedEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(1, 100)}}
    enforce_rate_limit = True

    def get(self, request):
        return Response({"ok": True})


class RateLimitUnenforcedEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(1, 100)}}
    enforce_rate_limit = False

    def get(self, request):
        return Response({"ok": True})


urlpatterns = [
    url(r"^/enforced$", RateLimitEnforcedEndpoint.as_view(), name="enforced-endpoint"),
    url(r"^/unenforced$", RateLimitUnenforcedEndpoint.as_view(), name="unenforced-endpoint"),
]


@override_settings(ROOT_URLCONF="tests.sentry.ratelimits.utils.test_enforce_rate_limit")
class EnforceRateLimitTest(APITestCase):
    def test_enforced_rate_limit(self):
        """Endpoints with enforce_rate_limit enabled should result in 429s"""
        with freeze_time("2000-01-01"):
            self.endpoint = "enforced-endpoint"
            response = self.get_response()
            assert response.status_code == 200

            response = self.get_response()
            assert response.status_code == 429

    def test_unenforced_rate_limit(self):
        """Endpoints with enforce_rate_limit disabled shouldn't reject requests"""
        with freeze_time("2000-01-01"):
            self.endpoint = "unenforced-endpoint"
            response = self.get_response()
            assert response.status_code == 200

            response = self.get_response()
            assert response.status_code == 200
