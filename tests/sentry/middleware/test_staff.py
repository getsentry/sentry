from __future__ import annotations

from django.test import override_settings
from django.urls import re_path
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import no_silo_test


class APITestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        return Response(status=200)


urlpatterns = [
    re_path(
        r"^api/0/test/$",
        APITestEndpoint.as_view(),
        name="test-endpoint",
    ),
]


@no_silo_test
@override_settings(
    ROOT_URLCONF=__name__,
    SENTRY_SELF_HOSTED=False,
)
class End2EndTest(APITestCase):
    endpoint = "test-endpoint"
    method = "get"

    def setUp(self):
        super().setUp()

    def test_as_superuser(self):
        self.login_as(self.create_user(is_staff=True), staff=True)

        response = self.get_success_response(status=200)
        # cookie name defaults to staff because imported
        # cookie name is not set when testing
        assert "staff" in response.cookies

    def test_not_superuser(self):
        self.login_as(self.create_user(is_staff=False))

        response = self.get_success_response(status=200)
        # cookie name defaults to staff because imported
        # cookie name is not set when testing
        assert "staff" not in response.cookies
