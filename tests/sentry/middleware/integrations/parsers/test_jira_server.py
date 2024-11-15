from typing import Any
from unittest import mock

import responses
from django.core.cache import cache
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from fixtures.integrations.stub_service import StubService
from sentry.middleware.integrations.parsers.jira_server import JiraServerRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

region = Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT)

region_config = (region,)

issue_updated_payload = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
no_changelog: dict[str, Any] = {}


@control_silo_test
class JiraServerRequestParserTest(TestCase):
    factory = RequestFactory()

    def get_response(self, req: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    @override_regions(region_config)
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, external_id="jira_server:1", provider="jira_server"
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_endpoint_no_integration(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})
        request = self.factory.post(route)
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        with mock.patch(
            "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
        ) as mock_get_token:
            mock_get_token.side_effect = ValueError("nope")
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @responses.activate
    def test_routing_endpoint_with_integration(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})

        request = self.factory.post(
            route, data=issue_updated_payload, content_type="application/json"
        )
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        with mock.patch(
            "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
        ) as mock_get_token:
            mock_get_token.return_value = self.integration
            response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"jira_server:{self.integration.id}",
            region_names=[region.name],
        )

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @responses.activate
    def test_routing_webhook_with_mailbox_buckets_low_volume(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})

        request = self.factory.post(
            route, data=issue_updated_payload, content_type="application/json"
        )
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        with mock.patch(
            "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
        ) as mock_get_token:
            mock_get_token.return_value = self.integration
            response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"jira_server:{self.integration.id}",
            region_names=[region.name],
        )

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @responses.activate
    def test_routing_webhook_with_mailbox_buckets_high_volume(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})

        request = self.factory.post(
            route, data=issue_updated_payload, content_type="application/json"
        )
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        with (
            mock.patch(
                "sentry.integrations.middleware.hybrid_cloud.parser.ratelimiter.is_limited"
            ) as mock_is_limited,
            mock.patch(
                "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
            ) as mock_get_token,
        ):
            mock_is_limited.return_value = True
            mock_get_token.return_value = self.integration
            response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            # Mailbox name should have an extra segment
            mailbox_name=f"jira_server:{self.integration.id}:1",
            region_names=[region.name],
        )

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @responses.activate
    def test_routing_webhook_with_mailbox_bucket_mode_active(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})

        request = self.factory.post(
            route, data=issue_updated_payload, content_type="application/json"
        )
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        use_bucket_key = f"webhookpayload:jira_server:{self.integration.id}:use_buckets"
        cache.set(use_bucket_key, 1)

        with mock.patch(
            "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
        ) as mock_get_token:
            mock_get_token.return_value = self.integration
            response = parser.get_response()

        cache.delete(use_bucket_key)
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            # Mailbox name should have an extra segment
            mailbox_name=f"jira_server:{self.integration.id}:1",
            region_names=[region.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_drop_request_without_changelog(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})
        request = self.factory.post(route, data=no_changelog, content_type="application/json")
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        with mock.patch(
            "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
        ) as mock_get_token:
            mock_get_token.return_value = self.integration
            response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_search_endpoint(self):
        route = reverse(
            "sentry-extensions-jiraserver-search",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "integration_id": self.integration.id,
            },
        )
        request = self.factory.get(route)
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()
