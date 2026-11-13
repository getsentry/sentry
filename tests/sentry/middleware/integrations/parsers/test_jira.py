from __future__ import annotations

from unittest.mock import MagicMock, patch

import responses
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.test import RequestFactory, override_settings
from rest_framework import status

from sentry.hybridcloud.models.webhookpayload import WebhookPayload
from sentry.hybridcloud.tasks.deliver_webhooks import perform_cell_request
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocation,
    ForgeInvocationTokenError,
)
from sentry.integrations.models.integration import Integration
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.jira import JiraRequestParser
from sentry.silo.base import SiloMode
from sentry.silo.util import WEBHOOK_DELIVERY_SIGNATURE_HEADER, verify_webhook_delivery_signature
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.outbox import (
    assert_no_webhook_payloads,
    assert_webhook_payloads_for_mailbox,
    override_mailbox_bucket_count,
)
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell, Locality

cell = Cell("us", 1, "http://us.testserver")
eu_cell = Cell("eu", 2, "http://eu.testserver")
locality = Locality("us", frozenset(["us"]), new_org_cell="us")
eu_locality = Locality("eu", frozenset(["eu"]), new_org_cell="eu")

cell_config = (cell, eu_cell)


@control_silo_test
class JiraRequestParserTest(TestCase):
    factory = RequestFactory()
    path_base = f"{IntegrationClassification.integration_prefix}jira"

    def setUp(self) -> None:
        super().setUp()
        # Pin the rate-derived width so routing assertions exercise the bucket key.
        self.enterContext(override_mailbox_bucket_count(64))

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
    def test_get_response_routing_to_cell_async_bucketed(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            path=f"{self.path_base}/issue-updated/",
            data={"issue": {"id": "10425"}},
            content_type="application/json",
        )
        parser = JiraRequestParser(request, self.get_response)

        with patch.object(parser, "get_integration_from_request") as method:
            method.return_value = integration
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            # 10425 % 64
            mailbox_name=f"jira:{integration.id}:57",
            cell_names=[cell.name],
            request=request,
        )

    def test_mailbox_bucket_id(self) -> None:
        request = self.factory.post(path=f"{self.path_base}/issue-updated/")
        parser = JiraRequestParser(request, self.get_response)

        assert parser.mailbox_bucket_id({"issue": {"id": "10403"}}) == 10403
        assert parser.mailbox_bucket_id({"issue": {"id": 10403}}) == 10403
        assert parser.mailbox_bucket_id({}) is None
        assert parser.mailbox_bucket_id({"issue": {}}) is None
        assert parser.mailbox_bucket_id({"issue": "LR-123"}) is None
        assert parser.mailbox_bucket_id({"issue": {"id": "LR-123"}}) is None

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


CLOUD_ID = "11111111-2222-3333-4444-555555555555"
INSTALLATION_ID = "ari:cloud:ecosystem::installation/test"


@control_silo_test
@override_settings(SENTRY_SUBNET_SECRET="secret")
@patch("sentry.integrations.jira.forge.invocation_token.verify_forge_invocation_token")
class JiraForgeIssueUpdatedParserTest(TestCase):
    factory = RequestFactory()
    path = f"{IntegrationClassification.integration_prefix}jira/forge/issue-updated/"

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_mailbox_bucket_count(64))
        self.enterContext(override_cells(cell_config))
        self.organization = self.create_organization(owner=self.user, cell="us")
        self.integration = self.create_integration(
            organization=self.organization,
            external_id=CLOUD_ID,
            provider="jira",
            metadata={"forge": {"installation_id": INSTALLATION_ID}},
        )

    def post(self, mock_verify: MagicMock, **invocation: str) -> HttpResponseBase:
        mock_verify.return_value = ForgeInvocation(
            app_id="ari:cloud:ecosystem::app/test",
            installation_id=invocation.get("installation_id", INSTALLATION_ID),
            api_base_url=f"https://api.atlassian.com/ex/jira/{CLOUD_ID}",
            cloud_id=CLOUD_ID,
            environment_type="DEVELOPMENT",
            module_key=invocation.get("module_key", "issue-updated"),
            principal=None,
        )
        request = self.factory.post(
            path=self.path,
            data={"issue": {"id": "10425"}},
            content_type="application/json",
            headers={
                "Authorization": "Bearer fit",
                "X-Forge-OAuth-System": "system-token",
                "X-Forge-OAuth-User": "user-token",
                WEBHOOK_DELIVERY_SIGNATURE_HEADER: "v0=forged",
            },
        )
        return JiraRequestParser(request, lambda _: HttpResponse(status=200)).get_response()

    @responses.activate
    def test_delivers_signed_event_without_forge_tokens(self, mock_verify: MagicMock) -> None:
        assert self.post(mock_verify).status_code == 202

        payload = WebhookPayload.objects.get()
        # 10425 % 64
        assert payload.mailbox_name == f"jira:us:{self.integration.id}:57"

        responses.add(responses.POST, f"http://us.testserver{self.path}", status=202)
        perform_cell_request(cell, payload)

        headers = responses.calls[0].request.headers
        assert verify_webhook_delivery_signature(
            self.path,
            headers["Authorization"],
            b'{"issue": {"id": "10425"}}',
            headers[WEBHOOK_DELIVERY_SIGNATURE_HEADER],
        )
        assert "X-Forge-OAuth-System" not in headers
        assert "X-Forge-OAuth-User" not in headers

    @override_settings(SENTRY_SUBNET_SECRET="")
    def test_asks_forge_to_retry_when_it_cannot_sign(self, mock_verify: MagicMock) -> None:
        assert self.post(mock_verify).status_code == 503
        assert_no_webhook_payloads()

    def test_drops_unverified_or_unowned_events(self, mock_verify: MagicMock) -> None:
        mock_verify.side_effect = ForgeInvocationTokenError("bad")
        assert self.post(mock_verify).status_code == 401
        mock_verify.side_effect = None

        # A UI module of the app, which any Jira user can drive.
        assert self.post(mock_verify, module_key="issue-panel").status_code == 403
        # Another app installed on the same site.
        assert self.post(mock_verify, installation_id="other").status_code == 202
        assert_no_webhook_payloads()
