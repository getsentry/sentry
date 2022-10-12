from datetime import datetime, timedelta

import isodate
from croniter import croniter
from django.conf import settings
from freezegun import freeze_time
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_410_GONE

from sentry import options
from sentry.api.base import Endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.options import register
from sentry.testutils import APITestCase

replacement_api = "replacement-api"
test_date = datetime.fromisoformat("2020-01-01T00:00:00+00:00:00")
timeiter = croniter("0 12 * * *", test_date)
default_duration = timedelta(minutes=1)

custom_cron = "30 1 * * *"
custom_duration = "PT1M1S"


class DummyEndpoint(Endpoint):
    permission_classes = ()

    @deprecated(test_date, suggested_api=replacement_api)
    def get(self, request):
        return Response({"ok": True})

    def head(self, request):
        return Response({"ok": True})

    @deprecated(test_date, suggested_api=replacement_api, key="override")
    def post(self, request):
        return Response({"ok": True})


dummy_endpoint = DummyEndpoint.as_view()


class TestDeprecationDecorator(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        settings.SENTRY_SELF_HOSTED = False

    def assert_deprecation_metadata(self, request: Request, response: Response):
        assert "X-Sentry-Deprecation-Date" in response
        assert "X-Sentry-Replacement-Endpoint" in response
        assert response["X-Sentry-Deprecation-Date"] == test_date.isoformat()
        assert response["X-Sentry-Replacement-Endpoint"] == replacement_api

    def assert_not_deprecated(self, method):
        request = self.make_request(method=method)
        resp = dummy_endpoint(request)
        assert resp.status_code == HTTP_200_OK
        assert "X-Sentry-Deprecation-Date" not in resp
        assert "X-Sentry-Replacement-Endpoint" not in resp

    def assert_allowed_request(self, method):
        request = self.make_request(method=method)
        request.META["HTTP_ORIGIN"] = "http://example.com"
        resp = dummy_endpoint(request)
        resp.render()
        assert resp.status_code == HTTP_200_OK
        self.assert_deprecation_metadata(request, resp)

    def assert_denied_request(self, method):
        request = self.make_request(method=method)
        resp = dummy_endpoint(request)
        assert resp.status_code == HTTP_410_GONE
        assert resp.data == {"message": "This API no longer exists."}
        self.assert_deprecation_metadata(request, resp)

    def test_before_deprecation_date(self):
        with freeze_time(test_date - timedelta(seconds=1)):
            self.assert_allowed_request("GET")

    def test_after_deprecation_date(self):
        with freeze_time(test_date):
            self.assert_allowed_request("GET")

        brownout_start = timeiter.get_next(datetime)
        with freeze_time(brownout_start):
            self.assert_denied_request("GET")

        mid_brownout = brownout_start + timedelta(seconds=1)
        with freeze_time(mid_brownout):
            self.assert_denied_request("GET")

        brownout_end = brownout_start + timedelta(minutes=1)
        with freeze_time(brownout_end):
            self.assert_allowed_request("GET")

    def test_self_hosted(self):
        settings.SENTRY_SELF_HOSTED = True
        self.assert_not_deprecated("GET")

    def test_no_decorator(self):
        self.assert_not_deprecated("HEAD")

    def test_default_key(self):
        options.delete("api.deprecation.brownout-cron")
        options.delete("api.deprecation.brownout-duration")
        settings.SENTRY_OPTIONS.update({"api.deprecation.brownout-cron": custom_cron})
        settings.SENTRY_OPTIONS.update({"api.deprecation.brownout-duration": custom_duration})

        custom_time_iter = croniter(custom_cron, test_date)
        custom_duration_timedelta = isodate.parse_duration(custom_duration)
        old_brownout_start = timeiter.get_next(datetime)
        with freeze_time(old_brownout_start):
            self.assert_allowed_request("GET")

        new_brownout_start = custom_time_iter.get_next(datetime)
        with freeze_time(new_brownout_start):
            self.assert_denied_request("GET")

        old_brownout_end = new_brownout_start + default_duration
        with freeze_time(old_brownout_end):
            self.assert_denied_request("GET")

        new_brownout_end = new_brownout_start + custom_duration_timedelta
        with freeze_time(new_brownout_end):
            self.assert_allowed_request("GET")

    def test_custom_key(self):
        old_brownout_start = timeiter.get_next(datetime)
        with freeze_time(old_brownout_start):
            self.assert_denied_request("POST")

        register("override-cron", default=custom_cron)
        register("override-duration", default=custom_duration)
        custom_time_iter = croniter(custom_cron, test_date)
        custom_duration_timedelta = isodate.parse_duration(custom_duration)

        with freeze_time(old_brownout_start):
            self.assert_allowed_request("POST")

        new_brownout_start = custom_time_iter.get_next(datetime)
        with freeze_time(new_brownout_start):
            self.assert_denied_request("POST")

        new_brownout_end = new_brownout_start + custom_duration_timedelta
        with freeze_time(new_brownout_end):
            self.assert_allowed_request("POST")

    def test_bad_schedule_format(self):
        options.delete("api.deprecation.brownout-duration")
        settings.SENTRY_OPTIONS.update({"api.deprecation.brownout-duration": "bad duration"})

        brownout_start = timeiter.get_next(datetime)
        with freeze_time(brownout_start):
            self.assert_allowed_request("GET")

            options.delete("api.deprecation.brownout-duration")
            settings.SENTRY_OPTIONS.update({"api.deprecation.brownout-duration": "PT1M"})
            self.assert_denied_request("GET")

            options.delete("api.deprecation.brownout-cron")
            settings.SENTRY_OPTIONS.update({"api.deprecation.brownout-cron": "bad schedule"})
            self.assert_allowed_request("GET")

            options.delete("api.deprecation.brownout-cron")
            settings.SENTRY_OPTIONS.update({"api.deprecation.brownout-cron": "0 12 * * *"})
            self.assert_denied_request("GET")
