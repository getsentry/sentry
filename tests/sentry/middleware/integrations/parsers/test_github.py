import orjson
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
from sentry.testutils.silo import control_silo_test, create_test_regions
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


@control_silo_test(regions=create_test_regions("us"))
class GithubRequestParserOverwatchForwarderTest(TestCase):
    factory = RequestFactory()
    path = reverse("sentry-integration-github-webhook")

    @pytest.fixture(autouse=True)
    def setup(self):
        with override_options({"github.webhook-type-routing.enabled": True}):
            yield

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(
            name="Test Org",
            slug="test-org",
            region="us",
            owner=self.create_user(email="test@example.com"),
        )
        self.integration = self.create_integration(
            provider="github",
            external_id="1",
            name="Test Integration",
            organization=self.organization,
        )

    @responses.activate
    def test_overwatch_forwarder(self) -> None:
        with (
            override_options({"overwatch.enabled-regions": ["us"]}),
            override_settings(
                OVERWATCH_REGION_URLS={"us": "https://us.example.com/api"},
                OVERWATCH_WEBHOOK_SECRET="test-secret",
            ),
        ):
            responses.add(
                responses.POST,
                "https://us.example.com/api/webhooks/sentry",
                status=200,
            )

            request = self.factory.post(
                self.path,
                data={"installation": {"id": "1"}, "action": "created"},
                content_type="application/json",
                headers={
                    "x-github-event": GithubWebhookType.PULL_REQUEST.value,
                    "x-github-hook-installation-target-id": "123",
                },
            )
            parser = GithubRequestParser(
                request=request,
                response_handler=lambda _: HttpResponse(status=200, content="passthrough"),
            )

            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == status.HTTP_202_ACCEPTED
            assert response.content == b""

            assert len(responses.calls) == 1
            assert responses.calls[0].request.url == "https://us.example.com/api/webhooks/sentry"
            assert responses.calls[0].request.method == "POST"
            json_body = orjson.loads(responses.calls[0].request.body)

            assert json_body["organizations"] == [
                {
                    "name": "Test Org",
                    "slug": "test-org",
                    "id": self.organization.id,
                    "region": "us",
                    "github_integration_id": self.integration.id,
                    "organization_integration_id": self.organization_integration.id,
                }
            ]
            assert json_body["webhook_body"] == {"installation": {"id": "1"}, "action": "created"}
            assert json_body["app_id"] == 123
            assert json_body["webhook_headers"]["X-Github-Event"] == "pull_request"
            assert json_body["integration_provider"] == "github"
            assert json_body["region"] == "us"
            assert json_body["event_type"] == "github"

    @responses.activate
    def test_overwatch_forwarder_missing_region_config(self) -> None:
        with (
            override_options({"overwatch.enabled-regions": ["us"]}),
            override_settings(
                OVERWATCH_REGION_URLS={"de": "https://de.example.com/api"},
                OVERWATCH_WEBHOOK_SECRET="test-secret",
            ),
        ):
            request = self.factory.post(
                self.path,
                data={"installation": {"id": "1"}, "action": "created"},
                content_type="application/json",
                headers={
                    "x-github-event": GithubWebhookType.PULL_REQUEST.value,
                    "x-github-hook-installation-target-id": "1",
                },
            )
            parser = GithubRequestParser(
                request=request,
                response_handler=lambda _: HttpResponse(status=200, content="passthrough"),
            )

            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == status.HTTP_202_ACCEPTED
            assert response.content == b""

            assert len(responses.calls) == 0
