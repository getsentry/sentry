from datetime import datetime, timedelta
from unittest import mock

import pytest
from cronsim import CronSim
from django.http.request import HttpRequest
from django.http.response import HttpResponse
from django.urls import ResolverMatch
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_410_GONE

from sentry import options
from sentry.api.base import Endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.auth.principal import set_request_principal
from sentry.auth.services.auth import AuthenticatedToken
from sentry.options import register
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import no_silo_test

replacement_api = "sentry-api-0-organization-projects"
replacement_api_resolved = "/api/0/organizations/:organization_id_or_slug/projects/"
test_date = datetime.fromisoformat("2020-01-01T00:00:00+00:00:00")
timeiter = CronSim("0 12 * * *", test_date)
default_duration = timedelta(minutes=1)

custom_cron = "30 1 * * *"
custom_duration = 61


class DummyEndpoint(Endpoint):
    permission_classes = ()

    @deprecated(test_date, suggested_api=replacement_api)
    def get(self, request: Request) -> Response:
        return Response({"ok": True})

    def head(self, request: Request) -> Response:
        return Response({"ok": True})

    @deprecated(test_date, suggested_api=replacement_api, key="override")
    def post(self, request: Request) -> Response:
        return Response({"ok": True})

    @deprecated(test_date, url_names=["sentry-dummy-delete-deprecated"])
    def delete(self, request: Request) -> Response:
        return Response({"ok": True})

    @deprecated(test_date, suggested_api="sentry-api-0-organization-projects")
    def put(self, request: Request) -> Response:
        return Response({"ok": True})

    @deprecated(test_date, suggested_api="sentry-api-0-organization-workflow-details")
    def patch(self, request: Request) -> Response:
        return Response({"ok": True})


dummy_endpoint = DummyEndpoint.as_view()


@no_silo_test
class TestDeprecationDecorator(APITestCase):
    def setUp(self) -> None:
        super().setUp()

    def assert_deprecation_metadata(self, request: HttpRequest, response: HttpResponse) -> None:
        assert "X-Sentry-Deprecation-Date" in response
        assert "X-Sentry-Replacement-Endpoint" in response
        assert response["X-Sentry-Deprecation-Date"] == test_date.isoformat()
        assert response["X-Sentry-Replacement-Endpoint"] == replacement_api_resolved

    def assert_not_deprecated(self, method: str) -> None:
        request = self.make_request(method=method)
        resp = dummy_endpoint(request)
        assert resp.status_code == HTTP_200_OK
        assert "X-Sentry-Deprecation-Date" not in resp
        assert "X-Sentry-Replacement-Endpoint" not in resp

    def assert_allowed_request(self, method: str) -> None:
        request = self.make_request(method=method)
        request.META["HTTP_ORIGIN"] = "http://example.com"
        resp = dummy_endpoint(request)
        resp.render()
        assert resp.status_code == HTTP_200_OK
        self.assert_deprecation_metadata(request, resp)

    def assert_denied_request(self, method: str) -> None:
        request = self.make_request(method=method)
        resp = dummy_endpoint(request)
        assert resp.status_code == HTTP_410_GONE
        assert resp.data == {"message": "This API no longer exists."}
        self.assert_deprecation_metadata(request, resp)

    def test_before_deprecation_date(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with freeze_time(test_date - timedelta(seconds=1)):
                self.assert_allowed_request("GET")

    def test_after_deprecation_date(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            with freeze_time(test_date):
                self.assert_allowed_request("GET")

            brownout_start = next(timeiter)
            with freeze_time(brownout_start):
                self.assert_denied_request("GET")

            mid_brownout = brownout_start + timedelta(seconds=1)
            with freeze_time(mid_brownout):
                self.assert_denied_request("GET")

            brownout_end = brownout_start + timedelta(minutes=1)
            with freeze_time(brownout_end):
                self.assert_allowed_request("GET")

    def test_self_hosted(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=True, ENVIRONMENT="production"):
            self.assert_not_deprecated("GET")

    def test_no_decorator(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.assert_not_deprecated("HEAD")

    def test_default_key(self) -> None:
        with (
            self.settings(SENTRY_SELF_HOSTED=False),
            override_options(
                {
                    "api.deprecation.brownout-duration": custom_duration,
                    "api.deprecation.brownout-cron": custom_cron,
                }
            ),
        ):
            custom_time_iter = CronSim(custom_cron, test_date)
            custom_duration_timedelta = timedelta(seconds=custom_duration)
            old_brownout_start = next(timeiter)
            with freeze_time(old_brownout_start):
                self.assert_allowed_request("GET")

            new_brownout_start = next(custom_time_iter)
            with freeze_time(new_brownout_start):
                self.assert_denied_request("GET")

            old_brownout_end = new_brownout_start + default_duration
            with freeze_time(old_brownout_end):
                self.assert_denied_request("GET")

            new_brownout_end = new_brownout_start + custom_duration_timedelta
            with freeze_time(new_brownout_end):
                self.assert_allowed_request("GET")

    def test_custom_key(self) -> None:
        with self.settings(
            SENTRY_SELF_HOSTED=False,
        ):
            old_brownout_start = next(timeiter)
            with freeze_time(old_brownout_start):
                self.assert_denied_request("POST")

            register("override-cron", default=custom_cron)
            register("override-duration", default=custom_duration)
            self.addCleanup(options.unregister, "override-cron")
            self.addCleanup(options.unregister, "override-duration")
            custom_time_iter = CronSim(custom_cron, test_date)
            custom_duration_timedelta = timedelta(seconds=custom_duration)

            with freeze_time(old_brownout_start):
                self.assert_allowed_request("POST")

            new_brownout_start = next(custom_time_iter)
            with freeze_time(new_brownout_start):
                self.assert_denied_request("POST")

            new_brownout_end = new_brownout_start + custom_duration_timedelta
            with freeze_time(new_brownout_end):
                self.assert_allowed_request("POST")

    def test_bad_schedule_format(self) -> None:
        brownout_start = next(timeiter)
        with freeze_time(brownout_start):
            with (
                self.settings(SENTRY_SELF_HOSTED=False),
                override_options(
                    {
                        "api.deprecation.brownout-duration": "bad duration",
                    },
                ),
            ):
                self.assert_allowed_request("GET")

            with (
                self.settings(SENTRY_SELF_HOSTED=False),
                override_options(
                    {
                        "api.deprecation.brownout-duration": 60,
                    },
                ),
            ):
                self.assert_denied_request("GET")

            with (
                self.settings(SENTRY_SELF_HOSTED=False),
                override_options(
                    {
                        "api.deprecation.brownout-cron": "bad schedule",
                    },
                ),
            ):
                self.assert_allowed_request("GET")

            with (
                self.settings(SENTRY_SELF_HOSTED=False),
                override_options(
                    {
                        "api.deprecation.brownout-cron": "0 12 * * *",
                    },
                ),
            ):
                self.assert_denied_request("GET")

    def test_with_url_names(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date - timedelta(minutes=1)):
            # Resolver url_name doesn't match
            request = self.make_request(method="DELETE")
            request.resolver_match = ResolverMatch(
                func=dummy_endpoint, args=tuple(), kwargs={}, url_name="sentry-dummy-delete"
            )

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert "X-Sentry-Deprecation-Date" not in resp
            assert "X-Sentry-Replacement-Endpoint" not in resp

            # Resolver url_name does match
            request = self.make_request(method="DELETE")
            request.resolver_match = ResolverMatch(
                func=dummy_endpoint,
                args=tuple(),
                kwargs={},
                url_name="sentry-dummy-delete-deprecated",
            )

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert "X-Sentry-Deprecation-Date" in resp

    def test_with_url_names_brownout(self) -> None:
        # Before the brownout
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date - timedelta(minutes=1)):
            request = self.make_request(method="DELETE")
            request.resolver_match = ResolverMatch(
                func=dummy_endpoint,
                args=tuple(),
                kwargs={},
                url_name="sentry-dummy-delete-deprecated",
            )

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert "X-Sentry-Deprecation-Date" in resp

            # url name that doesn't match is not deprecated
            request = self.make_request(method="DELETE")
            request.resolver_match = ResolverMatch(
                func=dummy_endpoint, args=tuple(), kwargs={}, url_name="sentry-dummy-delete"
            )

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert "X-Sentry-Deprecation-Date" not in resp

        # After the brownout
        brownout_start = next(timeiter)
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(brownout_start):
            request = self.make_request(method="DELETE")
            request.resolver_match = ResolverMatch(
                func=dummy_endpoint,
                args=tuple(),
                kwargs={},
                url_name="sentry-dummy-delete-deprecated",
            )

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_410_GONE
            assert "X-Sentry-Deprecation-Date" in resp

            # Other url names are not deprecated
            request = self.make_request(method="DELETE")
            request.resolver_match = ResolverMatch(
                func=dummy_endpoint, args=tuple(), kwargs={}, url_name="sentry-dummy-delete"
            )

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert "X-Sentry-Deprecation-Date" not in resp

    def test_suggested_api_route_name_resolves(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date - timedelta(seconds=1)):
            request = self.make_request(method="PUT")
            request.resolver_match = ResolverMatch(
                func=dummy_endpoint,
                args=tuple(),
                kwargs={"organization_id_or_slug": "my-org"},
                url_name="sentry-api-0-project-index",
            )

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert resp["X-Sentry-Replacement-Endpoint"] == "/api/0/organizations/my-org/projects/"

    def test_suggested_api_route_name_missing_params(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date - timedelta(seconds=1)):
            request = self.make_request(method="PATCH")
            request.resolver_match = ResolverMatch(
                func=dummy_endpoint,
                args=tuple(),
                kwargs={"organization_id_or_slug": "my-org"},
                url_name="sentry-api-0-some-endpoint",
            )

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert (
                resp["X-Sentry-Replacement-Endpoint"]
                == "/api/0/organizations/my-org/workflows/:workflow_id/"
            )

    def test_suggested_api_route_name_no_resolver_match(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date - timedelta(seconds=1)):
            request = self.make_request(method="PUT")

            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert (
                resp["X-Sentry-Replacement-Endpoint"]
                == "/api/0/organizations/:organization_id_or_slug/projects/"
            )

    def test_suggested_api_unknown_route_name(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date - timedelta(seconds=1)):

            class UnknownRouteEndpoint(Endpoint):
                permission_classes = ()

                @deprecated(test_date, suggested_api="nonexistent-route-name")
                def get(self, request: Request) -> Response:
                    return Response({"ok": True})

            endpoint = UnknownRouteEndpoint.as_view()
            request = self.make_request(method="GET")
            resp = endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert "X-Sentry-Deprecation-Date" in resp
            assert "X-Sentry-Replacement-Endpoint" not in resp

    def test_suggested_api_route_name_resolved_in_header(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date - timedelta(seconds=1)):
            request = self.make_request(method="GET")
            resp = dummy_endpoint(request)
            assert resp.status_code == HTTP_200_OK
            assert resp["X-Sentry-Replacement-Endpoint"] == replacement_api_resolved

    def test_applies_to_limits_deprecation_to_matching_requests(self) -> None:
        class ParamDeprecatedEndpoint(Endpoint):
            permission_classes = ()

            @deprecated(
                test_date,
                applies_to=lambda request: request.GET.get("mode") == "old",
                gone_message="The old mode is gone.",
            )
            def get(self, request: Request) -> Response:
                return Response({"ok": True})

        endpoint = ParamDeprecatedEndpoint.as_view()
        brownout_start = next(timeiter)
        with self.settings(SENTRY_SELF_HOSTED=False):
            with freeze_time(test_date - timedelta(seconds=1)):
                resp = endpoint(self.make_request(method="GET", GET={"mode": "old"}))
                assert resp.status_code == HTTP_200_OK
                assert resp["X-Sentry-Deprecation-Date"] == test_date.isoformat()

            with freeze_time(brownout_start):
                resp = endpoint(self.make_request(method="GET", GET={"mode": "old"}))
                assert resp.status_code == HTTP_410_GONE
                assert resp.data == {"message": "The old mode is gone."}
                assert resp["X-Sentry-Deprecation-Date"] == test_date.isoformat()

                resp = endpoint(self.make_request(method="GET", GET={"mode": "new"}))
                assert resp.status_code == HTTP_200_OK
                assert "X-Sentry-Deprecation-Date" not in resp

    @mock.patch("sentry.api.helpers.deprecation.sentry_sdk.metrics.count")
    def test_records_caller_metric_when_handler_raises(self, mock_count: mock.MagicMock) -> None:
        class RaisingEndpoint(Endpoint):
            permission_classes = ()

            @deprecated(test_date)
            def get(self, request: Request) -> Response:
                raise ValueError("Endpoint failed")

        endpoint = RaisingEndpoint()
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date + timedelta(hours=1)):
            request = Request(self.make_request(method="GET"))
            with pytest.raises(ValueError, match="Endpoint failed"):
                endpoint.get(request)

        mock_count.assert_called_once()
        assert mock_count.call_args.args == ("api.deprecated.request", 1)
        assert mock_count.call_args.kwargs["attributes"]["api.deprecated.action"] == "header"

    @mock.patch("sentry.api.helpers.deprecation.sentry_sdk.metrics.count")
    def test_records_caller_metric_once_during_brownout(self, mock_count: mock.MagicMock) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date.replace(hour=12)):
            self.assert_denied_request("GET")

        mock_count.assert_called_once()
        assert mock_count.call_args.args == ("api.deprecated.request", 1)
        assert mock_count.call_args.kwargs["attributes"]["api.deprecated.action"] == "gone"

    @mock.patch("sentry.api.helpers.deprecation.sentry_sdk.metrics.count")
    def test_records_caller_auth_kind(self, mock_count: mock.MagicMock) -> None:
        request = Request(self.make_request(method="GET"))
        set_request_principal(request, self.user, AuthenticatedToken(kind="agent_token"))
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date.replace(hour=12)):
            response = DummyEndpoint().get(request)

        assert response.status_code == HTTP_410_GONE
        mock_count.assert_called_once()
        assert (
            mock_count.call_args.kwargs["attributes"]["api.deprecated.auth_kind"] == "agent_token"
        )

    @mock.patch("sentry.api.helpers.deprecation.sentry_sdk.metrics.count")
    def test_records_caller_metric(self, mock_count: mock.MagicMock) -> None:
        class CallerEndpoint(Endpoint):
            permission_classes = ()

            @deprecated(
                test_date,
                key="override",
                metric_attributes=lambda request: {"mode": request.GET["mode"]},
            )
            def get(self, request: Request) -> Response:
                return Response({"ok": True})

        endpoint = CallerEndpoint.as_view()
        with self.settings(SENTRY_SELF_HOSTED=False), freeze_time(test_date - timedelta(seconds=1)):
            request = self.make_request(
                user=self.user, method="GET", path="/old/", GET={"mode": "old", "referrer": "r"}
            )
            request.META["HTTP_USER_AGENT"] = "my-script/1.0"
            resp = endpoint(request)

        assert resp.status_code == HTTP_200_OK
        mock_count.assert_called_once()
        name, value = mock_count.call_args.args
        assert (name, value) == ("api.deprecated.request", 1)
        assert mock_count.call_args.kwargs["attributes"] == {
            "mode": "old",
            "api.deprecated.url_name": "unknown",
            "api.deprecated.action": "header",
            "api.deprecated.auth_kind": "session",
            "api.deprecated.deprecation_date": test_date.isoformat(),
            "api.deprecated.brownout_key": "override",
            "referrer": "r",
            "user_agent.original": "my-script/1.0",
            "user.id": self.user.id,
            "http.request.method": "GET",
        }
