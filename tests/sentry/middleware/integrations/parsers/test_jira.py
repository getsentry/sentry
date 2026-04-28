from __future__ import annotations

from unittest.mock import patch

import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from rest_framework import status

from sentry.integrations.models.integration import Integration
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.jira import JiraRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell, Locality, RegionCategory

cell = Cell("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT)
eu_cell = Cell("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT)
locality = Locality("us", frozenset(["us"]), RegionCategory.MULTI_TENANT, new_org_cell="us")
eu_locality = Locality("eu", frozenset(["eu"]), RegionCategory.MULTI_TENANT, new_org_cell="eu")

cell_config = (cell, eu_cell)


@control_silo_test
class JiraRequestParserTest(TestCase):
    factory = RequestFactory()
    path_base = f"{IntegrationClassification.integration_prefix}jira"

    def get_response(self, req: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def get_integration(self) -> Integration:
        self.organization = self.create_organization(owner=self.user, cell="us")
        return self.create_integration(
            organization=self.organization, external_id="jira:1", provider="jira"
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_integration_from_request(self) -> None:
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
    @override_cells(cell_config)
    def test_get_response_routing_to_control(self) -> None:
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
            assert response.status_code == status.HTTP_200_OK
            assert response.content == b"passthrough"
            assert_no_webhook_payloads()

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_response_routing_to_cell_sync(self) -> None:
        responses.add(
            responses.POST,
            locality.to_url("/extensions/jira/issue/LR-123/"),
            body="cell response",
            status=200,
        )
        request = self.factory.post(path=f"{self.path_base}/issue/LR-123/")
        parser = JiraRequestParser(request, self.get_response)

        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = self.get_integration()
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"cell response"
        assert_no_webhook_payloads()

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_response_routing_to_cell_sync_retry_errors(self) -> None:
        responses.add(
            responses.POST,
            locality.to_url("/extensions/jira/issue/LR-123/"),
            body="cell response",
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
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"passthrough"
        assert_no_webhook_payloads()

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_response_routing_to_cell_async(self) -> None:
        request = self.factory.post(path=f"{self.path_base}/issue-updated/")
        parser = JiraRequestParser(request, self.get_response)

        integration = self.get_integration()
        assert_no_webhook_payloads()
        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = integration
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.content == b""

        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            mailbox_name=f"jira:{integration.id}", cell_names=[cell.name], request=request
        )

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_response_missing_org_integration(self) -> None:
        request = self.factory.post(path=f"{self.path_base}/issue-updated/")
        parser = JiraRequestParser(request, self.get_response)

        integration = self.create_provider_integration(
            provider="jira",
            external_id="blag",
        )
        assert_no_webhook_payloads()
        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = integration
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.content == b""

        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_cells(cell_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @responses.activate
    def test_get_response_invalid_path(self) -> None:
        # Invalid path
        request = self.factory.post(path="/new-route/for/no/reason/")
        parser = JiraRequestParser(request, self.get_response)

        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = self.get_integration()
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_cells(cell_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_multiple_cells(self) -> None:
        # Use GET — the view only handles GET, and Jira sends GET for issue hooks.
        request = self.factory.get(path=f"{self.path_base}/issue/LR-123/")
        parser = JiraRequestParser(request, self.get_response)

        other_org = self.create_organization(owner=self.user, cell="eu")
        integration = self.get_integration()
        integration.add_organization(other_org.id)

        with patch.object(parser, "get_integration_from_request") as mock_integration:
            mock_integration.return_value = integration
            response = parser.get_response()

        # Must not 404 — multi-cell falls back to JiraSentryIssueDetailsControlView, not
        # get_response_from_control_silo() which would 404 via the @cell_silo_view restriction.
        assert response.status_code == 200
        assert_no_webhook_payloads()
