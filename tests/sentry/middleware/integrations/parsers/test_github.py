from unittest.mock import Mock, patch

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
from sentry.testutils.cell import override_cells
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell, RegionCategory

cell = Cell("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
cell_config = (cell,)


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
    @override_cells(cell_config)
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
    @override_cells(cell_config)
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
    @override_cells(cell_config)
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
    @override_cells(cell_config)
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
    @override_cells(cell_config)
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
    @override_cells(cell_config)
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
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL, CODECOV_API_BASE_URL="https://api.codecov.io")
    @override_options(
        {
            "codecov.forward-webhooks.rollout": 1.0,
            "codecov.forward-webhooks.regions": ["us"],
            "codecov.forward-webhooks.disabled": False,
        }
    )
    @override_cells(cell_config)
    def test_webhook_for_codecov(self) -> None:
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
            cell_names=[cell.name],
            destination_types={DestinationType.SENTRY_REGION: 1},
        )
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name="github:codecov:1",
            cell_names=[],
            destination_types={DestinationType.CODECOV: 1},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL, CODECOV_API_BASE_URL="https://api.codecov.io")
    @override_options(
        {
            "codecov.forward-webhooks.rollout": 1.0,
            "codecov.forward-webhooks.regions": [],
            "codecov.forward-webhooks.disabled": False,
        }
    )
    @override_cells(cell_config)
    def test_webhook_for_codecov_no_cells(self) -> None:
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
            cell_names=[cell.name],
            destination_types={DestinationType.SENTRY_REGION: 1},
        )
        with pytest.raises(
            Exception,
            match="Missing 1 WebhookPayloads for codecov",
        ):
            assert_webhook_payloads_for_mailbox(
                request=request,
                mailbox_name="github:codecov:1",
                cell_names=[],
                destination_types={DestinationType.CODECOV: 1},
            )

    @override_settings(SILO_MODE=SiloMode.CONTROL, CODECOV_API_BASE_URL="https://api.codecov.io")
    @override_options(
        {
            "codecov.forward-webhooks.rollout": 1.0,
            "codecov.forward-webhooks.regions": ["us"],
            "codecov.forward-webhooks.disabled": True,
        }
    )
    @override_cells(cell_config)
    def test_webhook_no_codecov_payload_when_forwarding_disabled(self) -> None:
        """When codecov.forward-webhooks.disabled is True, only cell payload is created."""
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
            cell_names=[cell.name],
            destination_types={DestinationType.SENTRY_REGION: 1},
        )
        with pytest.raises(
            Exception,
            match="Missing 1 WebhookPayloads for codecov",
        ):
            assert_webhook_payloads_for_mailbox(
                request=request,
                mailbox_name="github:codecov:1",
                cell_names=[],
                destination_types={DestinationType.CODECOV: 1},
            )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
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
    @override_cells(cell_config)
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
            cell_names=[cell.name],
            destination_types={DestinationType.SENTRY_REGION: 1},
        )


@control_silo_test
class GithubRequestParserMailboxBucketingTest(TestCase):
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

    def test_mailbox_bucket_id_returns_repo_id(self) -> None:
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 35129377}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        assert parser.mailbox_bucket_id({"repository": {"id": 35129377}}) == 35129377

    def test_mailbox_bucket_id_returns_none_without_repository(self) -> None:
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.INSTALLATION.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        assert parser.mailbox_bucket_id({"installation": {"id": "1"}}) is None

    def test_mailbox_bucket_id_handles_malformed_payload(self) -> None:
        request = self.factory.post(
            self.path,
            data={},
            content_type="application/json",
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        assert parser.mailbox_bucket_id({"repository": "not-a-dict"}) is None
        assert parser.mailbox_bucket_id({"repository": {"id": "not-an-int"}}) is None
        assert parser.mailbox_bucket_id({"repository": {}}) is None
        assert parser.mailbox_bucket_id({}) is None

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_webhook_outbox_creation_with_bucketing(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 35129377}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )

        with override_options({"github.webhook.mailbox-bucketing.enabled": True}):
            parser = GithubRequestParser(request=request, response_handler=self.get_response)
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        # 35129377 % 100 = 77, event type appended for per-event-type isolation
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}:77:push",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_webhook_outbox_creation_with_bucketing_isolates_event_types(self) -> None:
        """Different event types for the same repo land in different mailboxes."""
        integration = self.get_integration()
        push_request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 35129377}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )
        check_run_request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 35129377}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.CHECK_RUN.value},
        )

        with override_options({"github.webhook.mailbox-bucketing.enabled": True}):
            push_parser = GithubRequestParser(
                request=push_request, response_handler=self.get_response
            )
            check_run_parser = GithubRequestParser(
                request=check_run_request, response_handler=self.get_response
            )
            assert push_parser.get_mailbox_identifier(
                integration, {}
            ) != check_run_parser.get_mailbox_identifier(integration, {})

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_webhook_outbox_creation_with_bucketing_no_event_type_header(self) -> None:
        """Falls back gracefully when X-GitHub-Event header is absent."""
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 35129377}},
            content_type="application/json",
            # No X-GITHUB-EVENT header
        )

        with override_options({"github.webhook.mailbox-bucketing.enabled": True}):
            parser = GithubRequestParser(request=request, response_handler=self.get_response)
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        # No event type header — identifier is repo-bucket only
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}:77",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_webhook_outbox_creation_without_bucketing(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 35129377}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_webhook_without_repository_uses_event_type_only(self) -> None:
        """No repository ID means no repo bucket, but event type still provides isolation."""
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.ISSUE.value},
        )

        with override_options({"github.webhook.mailbox-bucketing.enabled": True}):
            parser = GithubRequestParser(request=request, response_handler=self.get_response)
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}:issues",
            cell_names=[cell.name],
        )


@control_silo_test
class GithubRequestParserDropUnprocessedEventsTest(TestCase):
    """Tests for dropping GitHub webhook events that the cell does not process."""

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
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_unprocessed_event(self, mock_metrics: Mock) -> None:
        """Unprocessed event types (e.g. status) are dropped and metric is incremented."""
        self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 123}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": "status"},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={"event_type": "status"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_supported_event_never_dropped(self) -> None:
        """Supported event (push) is never dropped."""
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 123}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_missing_x_github_event_forwards_to_cell(self) -> None:
        """Missing X-GitHub-Event is forwarded to cell so it can return 400."""
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 123}},
            content_type="application/json",
            # No X-GitHub-Event header
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}",
            cell_names=[cell.name],
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
