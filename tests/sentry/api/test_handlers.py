from django.test import override_settings
from django.urls import re_path
from rest_framework.permissions import AllowAny

from sentry.api.base import Endpoint
from sentry.search.events.constants import RATE_LIMIT_ERROR_MESSAGE
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.snuba import RateLimitExceeded
from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded


class RateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        raise RateLimitExceeded(
            "Rate limit exceeded. Please try your query with a smaller date range or fewer projects."
        )

    def post(self, request):
        raise SnubaRPCRateLimitExceeded("Snuba is tired")


urlpatterns = [re_path(r"^/$", RateLimitedEndpoint.as_view(), name="sentry-test")]


@control_silo_test
@override_settings(ROOT_URLCONF=__name__)
class TestRateLimited(APITestCase):
    endpoint = "sentry-test"

    def test_simple(self) -> None:
        self.login_as(self.user)
        resp = self.get_response(method="get")
        assert resp.status_code == 429

        assert resp.data["detail"] == RATE_LIMIT_ERROR_MESSAGE

    def test_snuba_rpc(self) -> None:
        self.login_as(self.user)
        resp = self.get_response(method="post")
        assert resp.status_code == 429

        assert resp.data["detail"] == RATE_LIMIT_ERROR_MESSAGE
