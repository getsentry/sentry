import pytest
import responses
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.hybridcloud.models.webhookpayload import DestinationType
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.middleware.integrations.parsers.github import GithubRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
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
            external_id="1",
            provider="github",
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_invalid_webhook(self) -> None:
        if SiloMode.get_current_mode() != SiloMode.CONTROL:
            return

        self.get_integration()
        request = self.factory.post(
            self.path,
            data=b"invalid-data",
            content_type="application/x-www-form-urlencoded",
            headers={"X-GITHUB-EVENT": GithubWebhookType.INSTALLATION.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_no_organization_integration_found(self) -> None:
        integration = self.get_integration()
        with outbox_context(transaction.atomic(using=router.db_for_write(OrganizationIntegration))):
            # Remove all organizations from integration
            OrganizationIntegration.objects.filter(integration=integration).delete()

        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.ISSUE.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_no_integration_found(self) -> None:
        self.get_integration()
        request = self.factory.post(
            self.path,
            data={},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.ISSUE.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_search_properly(self) -> None:
        path = reverse(
            "sentry-integration-github-search",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "integration_id": self.integration.id,
            },
        )
        request = self.factory.post(
            path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.INSTALLATION.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_integration_from_request(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.INSTALLATION.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        result = parser.get_integration_from_request()
        assert result == integration

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_webhook_outbox_creation(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.ISSUE.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.content == b""
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}",
            region_names=[region.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL, CODECOV_API_BASE_URL="https://api.codecov.io")
    @override_options(
        {"codecov.forward-webhooks.rollout": 1.0, "codecov.forward-webhooks.regions": ["us"]}
    )
    @override_regions(region_config)
    def test_webhook_for_codecov(self):
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.content == b""
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}",
            region_names=[region.name],
            destination_types={DestinationType.SENTRY_REGION: 1},
        )
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name="github:codecov:1",
            region_names=[],
            destination_types={DestinationType.CODECOV: 1},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL, CODECOV_API_BASE_URL="https://api.codecov.io")
    @override_options(
        {"codecov.forward-webhooks.rollout": 1.0, "codecov.forward-webhooks.regions": []}
    )
    @override_regions(region_config)
    def test_webhook_for_codecov_no_regions(self):
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.content == b""
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}",
            region_names=[region.name],
            destination_types={DestinationType.SENTRY_REGION: 1},
        )
        with pytest.raises(
            Exception,
            match="Missing 1 WebhookPayloads for codecov",
        ):
            assert_webhook_payloads_for_mailbox(
                request=request,
                mailbox_name="github:codecov:1",
                region_names=[],
                destination_types={DestinationType.CODECOV: 1},
            )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_installation_created_routing(self) -> None:
        self.get_integration()
        request = self.factory.post(
            reverse("sentry-integration-github-webhook"),
            data={"installation": {"id": "1"}, "action": "created"},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.INSTALLATION.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    def test_installation_deleted_routing(self) -> None:
        request = self.factory.post(
            reverse("sentry-integration-github-webhook"),
            data={"installation": {"id": "1"}, "action": "deleted"},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.INSTALLATION.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_issue_deleted_routing(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            reverse("sentry-integration-github-webhook"),
            data={
                "installation": {"id": "1"},
                "issue": {"id": "1"},
                "action": "deleted",
                "repository": {"id": "1"},
            },
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.ISSUE.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}",
            region_names=[region.name],
            destination_types={DestinationType.SENTRY_REGION: 1},
        )


@control_silo_test
class GithubRequestParserTypeRoutingTest(GithubRequestParserTest):
    """
    Test fixture that runs the routing tests with header-based routing enabled.
    """

    @pytest.fixture(autouse=True)
    def setup(self):
        with override_options({"github.webhook-type-routing.enabled": True}):
            yield
