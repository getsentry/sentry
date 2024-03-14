import responses
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.integrations.parsers.github_enterprise import GithubEnterpriseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.outbox import ControlOutbox, OutboxCategory, outbox_context
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import (
    assert_no_webhook_outboxes,
    assert_no_webhook_payloads,
    assert_webhook_outboxes_with_shard_id,
    assert_webhook_payloads_for_mailbox,
)
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
region_config = (region,)


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
    @override_regions(region_config)
    def test_invalid_webhook(self):
        self.get_integration()
        request = self.factory.post(
            self.path, data=b"invalid-data", content_type="application/x-www-form-urlencoded"
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert response.status_code == 400

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_no_organization_integrations_found(self):
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
        assert_no_webhook_outboxes()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_no_integrations_found(self):
        self.get_integration()
        request = self.factory.post(self.path, data={}, content_type="application/json")
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 400
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_integration_from_request_no_host(self):
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
    @override_regions(region_config)
    def test_get_integration_from_request_with_host(self):
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
    @override_regions(region_config)
    @responses.activate
    def test_installation_hook_handled_in_control(self):
        self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}, "action": "created"},
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_webhook_outbox_creation(self):
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}, "action": "opened"},
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
        )

        assert ControlOutbox.objects.filter(category=OutboxCategory.WEBHOOK_PROXY).count() == 0

        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""
        assert_webhook_outboxes_with_shard_id(
            factory_request=request,
            expected_shard_id=integration.id,
            region_names=[region.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @override_options({"hybridcloud.webhookpayload.rollout": 1.0})
    def test_webhook_outbox_creation_webhookpayload(self):
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}, "action": "opened"},
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
        )
        assert_no_webhook_payloads()
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""

        assert_webhook_payloads_for_mailbox(
            mailbox_name=f"github_enterprise:{integration.id}", region_names=["us"], request=request
        )
