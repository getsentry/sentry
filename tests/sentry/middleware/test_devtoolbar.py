from functools import cached_property
from unittest.mock import MagicMock, patch

import pytest
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.api import DevToolbarApiRequestEvent
from sentry.middleware.devtoolbar import DevToolbarAnalyticsMiddleware
from sentry.testutils.cases import APITestCase, TestCase
from sentry.utils.urls import parse_id_or_slug_param


class DevToolbarAnalyticsMiddlewareUnitTest(TestCase):
    middleware = cached_property(DevToolbarAnalyticsMiddleware)
    analytics_event_name = DevToolbarApiRequestEvent.type

    @cached_property
    def factory(self):
        return RequestFactory()

    def setUp(self):
        # Allows changing the get_response mock for each test.
        self.get_response = MagicMock(return_value=HttpResponse(status=200))
        self.middleware.get_response = self.get_response

    def make_toolbar_request(
        self,
        path="/",
        method="GET",
        headers=None,
        incl_toolbar_header=True,
        resolver_match="mock",
    ):
        headers = headers or {}
        if incl_toolbar_header:
            headers["queryReferrer"] = "devtoolbar"
        request = getattr(self.factory, method.lower())(path, headers=headers)
        request.resolver_match = MagicMock() if resolver_match == "mock" else resolver_match
        return request

    @patch("sentry.analytics.record")
    def test_basic(self, mock_record: MagicMock):
        request = self.make_toolbar_request()
        self.middleware(request)
        mock_record.assert_called()
        assert mock_record.call_args[0][0] == self.analytics_event_name

    @patch("sentry.analytics.record")
    def test_no_devtoolbar_header(self, mock_record: MagicMock):
        request = self.make_toolbar_request(incl_toolbar_header=False)
        self.middleware(request)
        mock_record.assert_not_called()

        request = self.make_toolbar_request(
            headers={"queryReferrer": "not-toolbar"}, incl_toolbar_header=False
        )
        self.middleware(request)
        mock_record.assert_not_called()

    @patch("sentry.middleware.devtoolbar.logger.exception")
    @patch("sentry.analytics.record")
    def test_request_not_resolved(self, mock_record: MagicMock, mock_logger: MagicMock):
        request = self.make_toolbar_request()
        request.resolver_match = None
        self.middleware(request)

        mock_record.assert_not_called()
        mock_logger.assert_called()

    @patch("sentry.analytics.record")
    def test_endpoint_exception(self, mock_record: MagicMock):
        request = self.make_toolbar_request()
        self.get_response.side_effect = ValueError("endpoint crashed!")
        with pytest.raises(ValueError):  # re-raises same exc
            self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[0][0] == self.analytics_event_name
        assert mock_record.call_args[1].get("status_code") == 500

    #################
    # Attribute tests
    #################

    @patch("sentry.analytics.record")
    def test_view_name_and_route(self, mock_record: MagicMock):
        # Integration tests do a better job of testing these fields, since they involve route resolver.
        view_name = "my-endpoint"
        route = "/issues/(?P<issue_id>)/"
        request = self.make_toolbar_request(
            resolver_match=MagicMock(view_name=view_name, route=route),
        )
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[1].get("view_name") == view_name
        assert mock_record.call_args[1].get("route") == route

    @patch("sentry.analytics.record")
    def test_query_string(self, mock_record: MagicMock):
        query = "?a=b&statsPeriod=14d"
        request = self.make_toolbar_request(
            path="https://sentry.io/replays/" + query,
        )
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[1].get("query_string") == query

    @patch("sentry.analytics.record")
    def test_origin(self, mock_record: MagicMock):
        origin = "https://potato.com"
        request = self.make_toolbar_request(headers={"Origin": origin})
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[1].get("origin") == origin

    @patch("sentry.analytics.record")
    def test_origin_from_referrer(self, mock_record: MagicMock):
        origin = "https://potato.com"
        request = self.make_toolbar_request(headers={"Referer": origin + "/issues/?a=b"})
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[1].get("origin") == origin

    @patch("sentry.analytics.record")
    def test_response_status_code(self, mock_record: MagicMock):
        request = self.make_toolbar_request()
        self.get_response.return_value = HttpResponse(status=420)
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[1].get("status_code") == 420

    @patch("sentry.analytics.record")
    def test_methods(self, mock_record: MagicMock):
        for method in ["GET", "POST", "PUT", "DELETE"]:
            request = self.make_toolbar_request(method=method)
            self.middleware(request)

            mock_record.assert_called()
            assert mock_record.call_args[1].get("method") == method


TEST_MIDDLEWARE = (
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "sentry.middleware.auth.AuthenticationMiddleware",
    "sentry.middleware.devtoolbar.DevToolbarAnalyticsMiddleware",
)


class DevToolbarAnalyticsMiddlewareIntegrationTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.origin = "https://third-party.site.com"

    @override_settings(MIDDLEWARE=TEST_MIDDLEWARE)
    @patch("sentry.analytics.record")
    def _test_e2e(
        self,
        view_name: str,
        method: str,
        url_params: dict[str, str],
        query_string: str,
        mock_record: MagicMock,
    ):
        url = reverse(view_name, kwargs=url_params)
        url += query_string
        response: HttpResponse = getattr(self.client, method.lower())(
            url,
            headers={
                "queryReferrer": "devtoolbar",
                "Origin": self.origin,
                # TODO: could also set Referer header instead of Origin.
            },
        )

        org_id, org_slug = parse_id_or_slug_param(url_params.get("organization_id_or_slug"))
        proj_id, proj_slug = parse_id_or_slug_param(url_params.get("project_id_or_slug"))

        mock_record.assert_called_with(
            "devtoolbar.api_request",
            view_name=view_name,
            route="^api/0/organizations/(?P<organization_id_or_slug>[^\\/]+)/replays/$",
            query_string=query_string,
            origin=self.origin,
            method=method,
            status_code=response.status_code,
            organization_id=org_id,
            organization_slug=org_slug,
            project_id=proj_id,
            project_slug=proj_slug,
            user_id=self.user.id,
        )

    def test_e2e_replays(self):
        self._test_e2e(
            "sentry-api-0-organization-replay-index",
            "GET",
            {"organization_id_or_slug": self.organization.slug},
            "?field=id",
        )
        self._test_e2e(
            "sentry-api-0-organization-replay-index",
            "GET",
            {"organization_id_or_slug": str(self.organization.id)},
            "?field=id",
        )
