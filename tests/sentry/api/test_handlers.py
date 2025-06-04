from django.test import override_settings
from django.urls import re_path
from rest_framework.permissions import AllowAny

from sentry.api.base import Endpoint
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.snuba import RateLimitExceeded


class RateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        raise RateLimitExceeded(
            "Rate limit exceeded. Please try your query with a smaller date range or fewer projects."
        )


urlpatterns = [re_path(r"^/$", RateLimitedEndpoint.as_view(), name="sentry-test")]


@control_silo_test
@override_settings(ROOT_URLCONF="tests.sentry.api.test_handlers")
class TestRateLimited(APITestCase):
    endpoint = "sentry-test"

    def test_simple(self):
        self.login_as(self.user)
        resp = self.get_response()
        assert resp.status_code == 429

        assert (
            resp.data["detail"]
            == "Rate limit exceeded. Please try your query with a smaller date range or fewer projects."
        )
