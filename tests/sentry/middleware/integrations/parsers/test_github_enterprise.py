import orjson
import responses
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.hybridcloud.models.webhookpayload import WebhookPayload
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.middleware.integrations.parsers.github_enterprise import GithubEnterpriseRequestParser
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    WEBHOOK_DELIVERY_CONTEXT_HEADER,
    WEBHOOK_DELIVERY_CONTEXT_SIGNATURE_HEADER,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell

cell = Cell("us", 1, "https://us.testserver")
cell_config = (cell,)


@control_silo_test
class GithubEnterpriseRequestParserTest(TestCase):
    factory = RequestFactory()
    path = reverse("sentry-integration-github-enterprise-webhook")
    external_host = "12.345.678.901"
    external_identifier = "github_enterprise:1"
    external_id = f"{external_host}:{external_identifier}"

    def get_response(self, req: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def get_integration(self) -> Integration:
        return self.create_integration(
            organization=self.organization,
            external_id=self.external_id,
            provider="github_enterprise",
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_invalid_webhook(self) -> None:
        self.get_integration()
        request = self.factory.post(
            self.path, data=b"invalid-data", content_type="application/x-www-form-urlencoded"
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert response.status_code == 400

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_routing_no_organization_integrations_found(self) -> None:
        integration = self.get_integration()
        with outbox_context(transaction.atomic(using=router.db_for_write(OrganizationIntegration))):
            # Remove all organizations from integration
            OrganizationIntegration.objects.filter(integration=integration).delete()

        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}},
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 400
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_routing_no_integrations_found(self) -> None:
        self.get_integration()
        request = self.factory.post(self.path, data={}, content_type="application/json")
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 400
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_integration_from_request_no_host(self) -> None:
        # No host header
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}},
            content_type="application/json",
        )
        self.get_integration()
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        result = parser.get_integration_from_request()
        assert result is None

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_integration_from_request_with_host(self) -> None:
        # With host header
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}},
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
        )
        integration = self.get_integration()
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        result = parser.get_integration_from_request()
        assert result == integration

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_installation_hook_handled_in_control(self) -> None:
        self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}, "action": "created"},
            content_type="application/json",
            headers={
                "X-GITHUB-EVENT": "installation",
            },
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_webhook_outbox_creation(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}, "action": "opened"},
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
        )

        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github_enterprise:{integration.id}",
            cell_names=[cell.name],
        )

    @override_cells(cell_config)
    @override_options({"github.webhook.delivery-context.emit-rate": 1.0})
    def test_never_queues_a_delivery_context(self) -> None:
        """GitHub.com only. A copy the caller sent is dropped all the same."""
        self.get_integration()
        request = self.factory.post(
            self.path,
            data={
                "action": "completed",
                "installation": {"id": self.external_identifier},
                "repository": {"id": 123},
                "check_suite": {"pull_requests": [{"number": 7, "base": {"repo": {"id": 123}}}]},
            },
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
            HTTP_X_GITHUB_EVENT="check_suite",
            headers={
                WEBHOOK_DELIVERY_CONTEXT_HEADER: "forged",
                WEBHOOK_DELIVERY_CONTEXT_SIGNATURE_HEADER: "v1=forged",
            },
        )

        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert response.status_code == 202
        payload = WebhookPayload.objects.get()
        headers = {name.lower() for name in orjson.loads(payload.request_headers)}
        assert WEBHOOK_DELIVERY_CONTEXT_HEADER.lower() not in headers
        assert WEBHOOK_DELIVERY_CONTEXT_SIGNATURE_HEADER.lower() not in headers
