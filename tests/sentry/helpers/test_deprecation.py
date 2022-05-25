from datetime import datetime

from django.conf.urls import url
from django.test import override_settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.testutils import APITestCase

replacement_api = "replacement-api"


class TestEndpoint(Endpoint):
    permision_classes = (AllowAny,)

    @deprecated(datetime.fromisoformat("2020-01-01T00:00:00Z"), suggested_api=replacement_api)
    def get(self):
        return Response({"ok": True})

    def head(self):
        return Response({"ok": True})


urlpatterns = [url(r"^/testapi$", TestEndpoint.as_view(), name="deprecation-test-api")]


@override_settings(ROOT_URLCONF="tests.sentry.helpers.test_deprecation", SENTRY_SELF_HOSTED=False)
class TestDeprecationDecorator(APITestCase):

    endpoint = "deprecation-test-api"

    def has_ratelimit_meta(self):
        pass

    def assert_allowed_request(self):
        pass

    def assert_denied_request(self):
        pass

    def test_before_deprecation_date(self):
        pass

    def test_after_deprecation_date(self):
        pass

    def test_self_hosted(self):
        pass

    def test_no_header(self):
        pass
