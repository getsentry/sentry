from functools import cached_property
from unittest.mock import MagicMock, patch

from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.devtoolbar import DevToolbarAnalyticsMiddleware
from sentry.testutils.cases import APITestCase, TestCase
from sentry.utils.urls import parse_id_or_slug_param


class DevToolbarAnalyticsMiddlewareTest(TestCase):
    @cached_property
    def middleware(self):
        return DevToolbarAnalyticsMiddleware(lambda req: HttpResponse(status=200))

    @cached_property
    def factory(self):
        return RequestFactory()

    # @patch("sentry.analytics.record")
    # def test_records_event(self, mock_record):
    #     request = self.factory.get("/", headers={"queryReferrer": "devtoolbar"})
    #     # request._view_path = "/"
    #     # response = Mock(status_code=200)
    #
    #     response = self.middleware(request)
    #     print(response)
    #
    #     # assert response unchanged
    #
    #     mock_record.assert_called_with(
    #         "devtoolbar.api_request",
    #         # endpoint_name=endpoint_name,
    #         # url_pattern=url_name,  # TODO: test
    #         # query=query,
    #         # origin=origin,
    #         # response_code=response.status_code,
    #         # organization_id=str(org_id) if org_id else None,
    #         # organization_slug=org_slug,
    #         # project_id=str(project_id) if project_id else None,
    #         # project_slug=project_slug,
    #         # user_id=str(request.user.id) if request.user else None,
    #     )


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


"""
Unit: (just the middleware class, mock everything)
test response unchanged
test not called if missing header
test not called if request.resolver_match = None (also logs exc)
test exception raised from view_func (pass in get_response that raises)
- logs exc
- response_code 500

test all request methods
test all response status codes
test referrer header instead of origin
test no origin or referrer

Integration:
test endpoints w/org, project, group scopes (and maybe no scope?)
"""
