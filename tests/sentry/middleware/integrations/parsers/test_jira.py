from __future__ import annotations

from unittest.mock import patch

import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings

from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.jira import JiraRequestParser
from sentry.models.integrations.integration import Integration
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

region = Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT)
eu_region = Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT)

region_config = (region, eu_region)


@control_silo_test
class JiraRequestParserTest(TestCase):
    factory = RequestFactory()
    path_base = f"{IntegrationClassification.integration_prefix}jira"

    def get_response(self, req: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def get_integration(self) -> Integration:
        self.organization = self.create_organization(owner=self.user, region="us")
        return self.create_integration(
            organization=self.organization, external_id="jira:1", provider="jira"
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_integration_from_request(self):
        request = self.factory.post(path=f"{self.path_base}/issue-updated/")
        parser = JiraRequestParser(request, self.get_response)
        assert parser.get_integration_from_request() is None
        integration = self.get_integration()

        with patch(
            "sentry.middleware.integrations.parsers.jira.parse_integration_from_request"
        ) as mock_parse:
            mock_parse.return_value = integration
            assert parser.get_integration_from_request() == integration

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_response_routing_to_control(self):
        paths = [
            "/ui-hook/",
            "/descriptor/",
            "/installed/",
            "/uninstalled/",
            "/search/org/123/",
            "/configure/",
        ]
        for path in paths:
            request = self.factory.post(path=f"{self.path_base}{path}")
            parser = JiraRequestParser(request, self.get_response)

            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert_no_webhook_payloads()

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_response_routing_to_region_sync(self):
        responses.add(
            responses.POST,
            region.to_url("/extensions/jira/issue/LR-123/"),
            body="region response",
            status=200,
        )
        request = self.factory.post(path=f"{self.path_base}/issue/LR-123/")
        parser = JiraRequestParser(request, self.get_response)

        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = self.get_integration()
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"region response"
        assert_no_webhook_payloads()

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_response_routing_to_region_sync_retry_errors(self):
        responses.add(
            responses.POST,
            region.to_url("/extensions/jira/issue/LR-123/"),
            body="region response",
            status=503,
        )
        request = self.factory.post(path=f"{self.path_base}/issue/LR-123/")
        parser = JiraRequestParser(request, self.get_response)

        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = self.get_integration()
            response = parser.get_response()

        # There are 5 retries.
        assert len(responses.calls) == 6
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert_no_webhook_payloads()

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_response_routing_to_region_async(self):
        request = self.factory.post(path=f"{self.path_base}/issue-updated/")
        parser = JiraRequestParser(request, self.get_response)

        integration = self.get_integration()
        assert_no_webhook_payloads()
        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = integration
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""

        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            mailbox_name=f"jira:{integration.id}", region_names=[region.name], request=request
        )

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @responses.activate
    def test_get_response_invalid_path(self):
        # Invalid path
        request = self.factory.post(path="/new-route/for/no/reason/")
        parser = JiraRequestParser(request, self.get_response)

        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = self.get_integration()
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @responses.activate
    def test_get_response_multiple_regions(self):
        responses.add(
            responses.POST,
            eu_region.to_url("/extensions/jira/issue/LR-123/"),
            body="region response",
            status=200,
        )
        request = self.factory.post(path=f"{self.path_base}/issue/LR-123/")
        parser = JiraRequestParser(request, self.get_response)

        # Add a second organization. Jira only supports single regions.
        other_org = self.create_organization(owner=self.user, region="eu")
        integration = self.get_integration()
        integration.add_organization(other_org.id)

        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = integration
            response = parser.get_response()

        # Response should go to first region
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"region response"
        assert len(responses.calls) == 1
        assert_no_webhook_payloads()
