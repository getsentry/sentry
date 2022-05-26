from datetime import datetime, timedelta

from croniter import croniter
from django.conf import settings
from freezegun import freeze_time
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_410_GONE

from sentry.api.base import Endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.testutils import APITestCase

replacement_api = "replacement-api"
test_date = datetime.fromisoformat("2020-01-01T00:00:00+00:00:00")
timeiter = croniter("* 12 * * *", test_date)


class TestEndpoint(Endpoint):
    __test__ = False
    permision_classes = ()

    @deprecated(test_date, suggested_api=replacement_api)
    def get(self, request):
        return Response({"ok": True})

    def head(self, request):
        return Response({"ok": True})


test_endpoint = TestEndpoint.as_view()


class TestDeprecationDecorator(APITestCase):
    def assert_deprecation_metadata(self, request: Request, response: Response):
        assert hasattr(request, "is_deprecated")
        assert hasattr(request, "deprecation_date")
        assert "X-Sentry-Deprecation-Date" in response
        assert "X-Sentry-Replacement-Endpoint" in response
        assert request.is_deprecated
        assert request.deprecation_date == test_date
        assert response["X-Sentry-Deprecation-Date"] == test_date.isoformat()
        assert response["X-Sentry-Replacement-Endpoint"] == replacement_api

    def assert_not_deprecated(self, method):
        request = self.make_request(method=method)
        resp = test_endpoint(request)
        assert resp.status_code == HTTP_200_OK
        assert not hasattr(request, "is_deprecated")
        assert not hasattr(request, "deprecation_date")
        assert "X-Sentry-Deprecation-Date" not in resp
        assert "X-Sentry-Replacement-Endpoint" not in resp

    def assert_allowed_request(self, method):
        request = self.make_request(method=method)
        request.META["HTTP_ORIGIN"] = "http://example.com"
        resp = test_endpoint(request)
        resp.render()
        assert resp.status_code == HTTP_200_OK
        self.assert_deprecation_metadata(request, resp)

    def assert_denied_request(self, method):
        request = self.make_request(method=method)
        resp = test_endpoint(request)
        assert resp.status_code == HTTP_410_GONE
        assert resp.data == {"message": "This API no longer exists."}
        self.assert_deprecation_metadata(request, resp)

    @freeze_time(test_date - timedelta(seconds=1))
    def test_before_deprecation_date(self):
        self.assert_allowed_request("GET")

    def test_after_deprecation_date(self):
        with freeze_time(test_date):
            self.assert_allowed_request("GET")

        brownout_start = timeiter.get_next(datetime)
        with freeze_time(brownout_start):
            self.assert_denied_request("GET")

        brownout_end = brownout_start + timedelta(minutes=1)
        with freeze_time(brownout_end):
            self.assert_allowed_request("GET")

    def test_self_hosted(self):
        settings.SENTRY_SELF_HOSTED = True
        self.assert_not_deprecated("GET")

    def test_no_decorator(self):
        self.assert_not_deprecated("HEAD")
