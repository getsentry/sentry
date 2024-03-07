import responses
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.integrations.parsers.github import GithubRequestParser
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
class GithubRequestParserTest(TestCase):
    factory = RequestFactory()
    path = reverse("sentry-integration-github-webhook")

    def get_response(self, req: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def get_integration(self) -> Integration:
        return self.create_integration(
            organization=self.organization,
            external_id="github:1",
            provider="github",
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_invalid_webhook(self):
        if SiloMode.get_current_mode() != SiloMode.CONTROL:
            return

        self.get_integration()
        request = self.factory.post(
            self.path, data=b"invalid-data", content_type="application/x-www-form-urlencoded"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert response.status_code == 400

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_no_organization_integration_found(self):
        integration = self.get_integration()
        with outbox_context(transaction.atomic(using=router.db_for_write(OrganizationIntegration))):
            # Remove all organizations from integration
            OrganizationIntegration.objects.filter(integration=integration).delete()

        request = self.factory.post(
            self.path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 400
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_no_integration_found(self):
        self.get_integration()
        request = self.factory.post(self.path, data={}, content_type="application/json")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 400
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_search_properly(self):
        path = reverse(
            "sentry-integration-github-search",
            kwargs={
                "organization_slug": self.organization.slug,
                "integration_id": self.integration.id,
            },
        )
        request = self.factory.post(
            path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_integration_from_request(self):
        integration = self.get_integration()
        request = self.factory.post(
            self.path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        result = parser.get_integration_from_request()
        assert result == integration

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_webhook_outbox_creation(self):
        integration = self.get_integration()
        request = self.factory.post(
            self.path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        assert ControlOutbox.objects.filter(category=OutboxCategory.WEBHOOK_PROXY).count() == 0
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

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
            self.path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        assert_no_webhook_payloads()
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""

        assert_webhook_payloads_for_mailbox(
            mailbox_name=f"github:{integration.id}", region_names=["us"], request=request
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_installation_created_routing(self):
        self.get_integration()
        request = self.factory.post(
            reverse("sentry-integration-github-webhook"),
            data={"installation": {"id": "github:1"}, "action": "created"},
            content_type="application/json",
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

    def test_installation_deleted_routing(self):
        request = self.factory.post(
            reverse("sentry-integration-github-webhook"),
            data={"installation": {"id": "github:1"}, "action": "deleted"},
            content_type="application/json",
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()
