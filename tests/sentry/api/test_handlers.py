from __future__ import absolute_import

import math

from django.conf.urls import url
from django.test import override_settings
from rest_framework.permissions import AllowAny

from sentry.api.base import Endpoint
from sentry.utils.snuba import RateLimitExceeded
from sentry.testutils import APITestCase


class RateLimitedEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        raise RateLimitExceeded()


urlpatterns = [url(r"^/$", RateLimitedEndpoint.as_view(), name="sentry-test")]


@override_settings(ROOT_URLCONF="tests.sentry.api.test_handlers")
class TestRateLimited(APITestCase):
    endpoint = "sentry-test"

    def test_simple(self):
        self.login_as(self.user)
        resp = self.get_response()
        assert resp.status_code == 429

        # DRF ceils our configured wait time, this produces a different number
        # type between 2 and 3. In 2 this produces a float, in 3 this produces
        # an integer.
        assert resp.data[
            "detail"
        ] == u"Request was throttled. Expected available in {} second.".format(math.ceil(1))
