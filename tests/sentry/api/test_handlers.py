from __future__ import absolute_import

from django.conf.urls import patterns, url
from rest_framework.permissions import AllowAny

from sentry.api.base import Endpoint
from sentry.utils.snuba import RateLimitExceeded
from sentry.testutils import APITestCase


class RateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        raise RateLimitExceeded()


urlpatterns = patterns("", url(r"^/$", RateLimitedEndpoint.as_view(), name="sentry-test"))


class TestRateLimited(APITestCase):
    endpoint = "sentry-test"
    urls = "tests.sentry.api.test_handlers"

    def test_simple(self):
        self.login_as(self.user)
        resp = self.get_response()
        assert resp.status_code == 429
        assert resp.data["detail"] == "Request was throttled. Expected available in 1 second."
