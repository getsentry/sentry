from functools import cached_property
from unittest.mock import MagicMock, patch

from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from sentry.api import DevToolbarApiRequestEvent
from sentry.middleware.devtoolbar import DevToolbarAnalyticsMiddleware
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers import override_options
from sentry.types.group import GroupSubStatus


class DevToolbarAnalyticsMiddlewareUnitTest(TestCase):
    middleware = cached_property(DevToolbarAnalyticsMiddleware)
    analytics_event_name = DevToolbarApiRequestEvent.type

    @cached_property
    def factory(self):
        return RequestFactory()

    def setUp(self):
        # Allows changing the get_response mock for each test.
        self.middleware.get_response = MagicMock(return_value=HttpResponse(status=200))

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_basic(self, mock_record: MagicMock):
        request = self.factory.get("/?queryReferrer=devtoolbar")
        request.resolver_match = MagicMock()
        self.middleware(request)
        mock_record.assert_called()
        assert mock_record.call_args[0][0] == self.analytics_event_name

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_no_devtoolbar_header(self, mock_record: MagicMock):
        request = self.factory.get("/")
        request.resolver_match = MagicMock()
        self.middleware(request)
        mock_record.assert_not_called()

        request = self.factory.get("/?queryReferrer=not-toolbar")
        request.resolver_match = MagicMock()
        self.middleware(request)
        mock_record.assert_not_called()

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.middleware.devtoolbar.logger.exception")
    @patch("sentry.analytics.record")
    def test_request_not_resolved(self, mock_record: MagicMock, mock_logger: MagicMock):
        request = self.factory.get("/?queryReferrer=devtoolbar")
        request.resolver_match = None
        self.middleware(request)

        mock_record.assert_not_called()
        mock_logger.assert_called()

    #################
    # Attribute tests
    #################

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_view_name_and_route(self, mock_record: MagicMock):
        # Integration tests do a better job of testing these fields, since they involve route resolver.
        view_name = "my-endpoint"
        route = "/issues/(?P<issue_id>)/"
        request = self.factory.get("/?queryReferrer=devtoolbar")
        request.resolver_match = MagicMock(view_name=view_name, route=route)
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[0][0] == self.analytics_event_name
        assert mock_record.call_args[1].get("view_name") == view_name
        assert mock_record.call_args[1].get("route") == route

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_query_string(self, mock_record: MagicMock):
        query = "?a=b&statsPeriod=14d&queryReferrer=devtoolbar"
        request = self.factory.get("/" + query)
        request.resolver_match = MagicMock()
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[0][0] == self.analytics_event_name
        assert mock_record.call_args[1].get("query_string") == query

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_origin(self, mock_record: MagicMock):
        origin = "https://potato.com"
        request = self.factory.get(
            f"{origin}/?queryReferrer=devtoolbar", headers={"Origin": origin}
        )
        request.resolver_match = MagicMock()
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[0][0] == self.analytics_event_name
        assert mock_record.call_args[1].get("origin") == origin

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_origin_from_referrer(self, mock_record: MagicMock):
        origin = "https://potato.com"
        url = origin + "/issues/?a=b&queryReferrer=devtoolbar"
        request = self.factory.get(url, headers={"Referer": url})
        request.resolver_match = MagicMock()
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[0][0] == self.analytics_event_name
        assert mock_record.call_args[1].get("origin") == origin

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_response_status_code(self, mock_record: MagicMock):
        request = self.factory.get("/?queryReferrer=devtoolbar")
        request.resolver_match = MagicMock()
        self.middleware.get_response.return_value = HttpResponse(status=420)
        self.middleware(request)

        mock_record.assert_called()
        assert mock_record.call_args[0][0] == self.analytics_event_name
        assert mock_record.call_args[1].get("status_code") == 420

    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_methods(self, mock_record: MagicMock):
        for method in ["GET", "POST", "PUT", "DELETE"]:
            request = getattr(self.factory, method.lower())("/?queryReferrer=devtoolbar")
            request.resolver_match = MagicMock()
            self.middleware(request)

            mock_record.assert_called()
            assert mock_record.call_args[0][0] == self.analytics_event_name
            assert mock_record.call_args[1].get("method") == method


TEST_MIDDLEWARE = (
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "sentry.middleware.auth.AuthenticationMiddleware",
    "sentry.middleware.devtoolbar.DevToolbarAnalyticsMiddleware",
)


class DevToolbarAnalyticsMiddlewareIntegrationTest(APITestCase, SnubaTestCase):
    """
    Tests the route resolution logic by actually installing the middleware and requesting some endpoints.
    """

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.origin = "https://third-party.site.com"

    @override_settings(MIDDLEWARE=TEST_MIDDLEWARE)
    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_organization_replays(self, mock_record: MagicMock):
        path = f"/api/0/organizations/{self.organization.slug}/replays/"
        query_string = "?field=id&queryReferrer=devtoolbar"
        view_name = "sentry-api-0-organization-replay-index"
        route = "^api/0/organizations/(?P<organization_id_or_slug>[^\\/]+)/replays/$"
        method = "GET"

        url = path + query_string
        response: HttpResponse = getattr(self.client, method.lower())(
            url,
            headers={
                "queryReferrer": "devtoolbar",
                "Origin": self.origin,
            },
        )

        mock_record.assert_called_with(
            "devtoolbar.api_request",
            view_name=view_name,
            route=route,
            query_string=query_string,
            origin=self.origin,
            method=method,
            status_code=response.status_code,
            organization_id=None,
            organization_slug=self.organization.slug,
            project_id=None,
            project_slug=None,
            user_id=self.user.id,
        )

    @override_settings(MIDDLEWARE=TEST_MIDDLEWARE)
    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_group_details(self, mock_record: MagicMock):
        group = self.create_group(substatus=GroupSubStatus.NEW)

        path = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/"
        query_string = "?queryReferrer=devtoolbar"
        method = "GET"
        view_name = "sentry-api-0-organization-group-group-details"
        route = "^api/0/organizations/(?P<organization_id_or_slug>[^\\/]+)/(?:issues|groups)/(?P<issue_id>[^\\/]+)/$"

        url = path + query_string
        response: HttpResponse = getattr(self.client, method.lower())(
            url,
            headers={
                "queryReferrer": "devtoolbar",
                "Origin": self.origin,
            },
        )

        mock_record.assert_called_with(
            "devtoolbar.api_request",
            view_name=view_name,
            route=route,
            query_string=query_string,
            origin=self.origin,
            method=method,
            status_code=response.status_code,
            organization_id=None,
            organization_slug=self.organization.slug,
            project_id=None,
            project_slug=None,
            user_id=self.user.id,
        )

    @override_settings(MIDDLEWARE=TEST_MIDDLEWARE)
    @override_options({"devtoolbar.analytics.enabled": True})
    @patch("sentry.analytics.record")
    def test_project_user_feedback(self, mock_record: MagicMock):
        # Should return 400 (no POST data)
        path = f"/api/0/projects/{self.organization.slug}/{self.project.id}/user-feedback/"
        query_string = "?queryReferrer=devtoolbar"
        method = "POST"
        view_name = "sentry-api-0-project-user-reports"
        route = r"^api/0/projects/(?P<organization_id_or_slug>[^\/]+)/(?P<project_id_or_slug>[^\/]+)/(?:user-feedback|user-reports)/$"

        url = path + query_string
        response: HttpResponse = getattr(self.client, method.lower())(
            url,
            headers={
                "queryReferrer": "devtoolbar",
                "Origin": self.origin,
            },
        )

        mock_record.assert_called_with(
            "devtoolbar.api_request",
            view_name=view_name,
            route=route,
            query_string=query_string,
            origin=self.origin,
            method=method,
            status_code=response.status_code,
            organization_id=None,
            organization_slug=self.organization.slug,
            project_id=self.project.id,
            project_slug=None,
            user_id=self.user.id,
        )
