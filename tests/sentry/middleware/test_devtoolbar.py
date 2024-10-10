from functools import cached_property
from unittest.mock import MagicMock, patch

from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.devtoolbar import DevToolbarAnalyticsMiddleware
from sentry.testutils.cases import APITestCase, TestCase
from sentry.utils.urls import parse_id_or_slug_param


class DevToolbarAnalyticsMiddlewareUnitTest(TestCase):
    @cached_property
    def factory(self):
        return RequestFactory()

    def setUp(self):
        self.get_response = MagicMock(return_value=HttpResponse(status=200))
        self.middleware = DevToolbarAnalyticsMiddleware(self.get_response)

    def make_toolbar_get_request(
        self,
        path,
        headers="default",
        resolver_match="mock",
    ):
        """Convenience method."""
        if headers == "default":
            headers = {"queryReferrer": "devtoolbar"}
        request = self.factory.get(path, headers=headers)
        request.resolver_match = MagicMock() if resolver_match == "mock" else resolver_match
        return request

    @patch("sentry.analytics.record")
    def test_basic(self, mock_record: MagicMock):
        request = self.make_toolbar_get_request("/")
        self.middleware(request)
        assert mock_record.call_count == 1

    @patch("sentry.analytics.record")
    def test_no_devtoolbar_header(self, mock_record: MagicMock):
        request = self.make_toolbar_get_request("/", headers={})
        self.middleware(request)
        mock_record.assert_not_called()

        request = self.make_toolbar_get_request("/", headers={"queryReferrer": "not-toolbar"})
        self.middleware(request)
        mock_record.assert_not_called()

    @patch("sentry.middleware.devtoolbar.logger.exception")
    @patch("sentry.analytics.record")
    def test_request_not_resolved(self, mock_record: MagicMock, mock_logger: MagicMock):
        request = self.make_toolbar_get_request("/")
        request.resolver_match = None
        self.middleware(request)

        mock_record.assert_not_called()
        mock_logger.assert_called()

        # mock_record.assert_called_with(
        #     "devtoolbar.api_request",
        #     # endpoint_name=endpoint_name,
        #     # url_pattern=url_name,  # TODO: test
        #     # query=query,
        #     # origin=origin,
        #     # response_code=response.status_code,
        #     # organization_id=str(org_id) if org_id else None,
        #     # organization_slug=org_slug,
        #     # project_id=str(project_id) if project_id else None,
        #     # project_slug=project_slug,
        #     # user_id=str(request.user.id) if request.user else None,
        # )


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
    def _test_records_event(
        self, endpoint_name: str, method: str, url_params: dict[str, str], mock_record: MagicMock
    ):
        url = reverse(endpoint_name, kwargs=url_params)
        get_response = getattr(self.client, method.lower())
        response: HttpResponse = get_response(
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
            endpoint_name=endpoint_name,
            route="^api/0/organizations/(?P<organization_id_or_slug>[^\\/]+)/replays/$",
            query_string="",
            origin=self.origin,
            request_method=method,
            response_code=response.status_code,
            organization_id=org_id,
            organization_slug=org_slug,
            project_id=proj_id,
            project_slug=proj_slug,
            user_id=self.user.id,
        )

    def test_records_event(self):
        self._test_records_event(
            "sentry-api-0-organization-replay-index",
            "GET",
            {"organization_id_or_slug": self.organization.slug},
        )
        self._test_records_event(
            "sentry-api-0-organization-replay-index",
            "GET",
            {"organization_id_or_slug": str(self.organization.id)},
        )
