from __future__ import annotations

from django.conf import settings
from django.test import override_settings
from django.urls import re_path
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.testutils.cases import APITestCase


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


def provision_middleware():
    middleware = list(settings.MIDDLEWARE)
    if "sentry.middleware.staff.StaffMiddleware" not in middleware:
        index = middleware.index("sentry.middleware.superuser.SuperuserMiddleware")
        middleware.insert(index + 1, "sentry.middleware.staff.StaffMiddleware")
    return middleware


@override_settings(
    ROOT_URLCONF=__name__,
    SENTRY_SELF_HOSTED=False,
    SENTRY_USE_CUSTOMER_DOMAINS=True,
)
class End2EndTest(APITestCase):
    endpoint = "test-endpoint"
    method = "get"

    def setUp(self):
        super().setUp()
        self.middleware = provision_middleware()

    def test_simple(self):
        self.create_organization(name="albertos-apples")

        response = self.get_success_response(status=200)
        staff = getattr(response, "staff")
        assert staff
