from unittest.mock import Mock, patch

import pytest
import responses
from django.core.handlers.wsgi import WSGIRequest
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.hybridcloud.models.webhookpayload import DestinationType, WebhookPayload
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.middleware.hybrid_cloud.parser import SHED_INBOUND_KILLSWITCH
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.middleware.integrations.parsers.github import GithubRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell

cell = Cell("us", 1, "https://us.testserver")
cell_config = (cell,)

DROP_NO_OWN_REPO_PR_OPTION = "hybridcloud.webhookpayload.github_drop_checks_without_own_repo_pr"


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
    def test_installation_repositories_routes_to_control_silo(self) -> None:
        request = self.factory.post(
            self.path,
            data={
                "installation": {"id": "1"},
                "repositories_added": [],
                "repositories_removed": [],
            },
            content_type="application/json",
            headers={
                "X-GITHUB-EVENT": GithubWebhookType.INSTALLATION_REPOSITORIES.value,
            },
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        assert parser.should_route_to_control_silo(parsed_event={}, request=request)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_installation_routes_to_control_silo(self) -> None:
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={
                "X-GITHUB-EVENT": GithubWebhookType.INSTALLATION.value,
            },
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        assert parser.should_route_to_control_silo(parsed_event={}, request=request)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_push_does_not_route_to_control_silo(self) -> None:
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}},
            content_type="application/json",
            headers={
                "X-GITHUB-EVENT": GithubWebhookType.PUSH.value,
            },
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        assert not parser.should_route_to_control_silo(parsed_event={}, request=request)

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
            mailbox_name=f"github:{integration.id}:issues",
            cell_names=[cell.name],
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
            mailbox_name=f"github:{integration.id}:issues",
            cell_names=[cell.name],
            destination_types={DestinationType.SENTRY_CELL: 1},
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

        push_parser = GithubRequestParser(request=push_request, response_handler=self.get_response)
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
    def test_webhook_without_repository_uses_event_type_only(self) -> None:
        """No repository ID means no repo bucket, but event type still provides isolation."""
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
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}:issues",
            cell_names=[cell.name],
        )


@control_silo_test
class GithubRequestParserDropUnprocessedEventsTest(TestCase):
    """Tests for the control-side filter that drops events no cell consumes, and for
    the counters recorded on either side of it."""

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
            tags={"event_type": "status", "reason": "unprocessed_event_type"},
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
            mailbox_name=f"github:{integration.id}:23:push",
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
            mailbox_name=f"github:{integration.id}:23",
            cell_names=[cell.name],
        )

    def _post_check_event(
        self,
        action: object,
        event_type: GithubWebhookType = GithubWebhookType.CHECK_RUN,
        container: object | None = None,
    ) -> WSGIRequest:
        """POST a check_run/check_suite payload. ``container`` populates the payload
        member named after the event, which is where GitHub lists the PRs it matched."""
        data: dict[str, object] = {"installation": {"id": "1"}, "repository": {"id": 123}}
        if action is not None:
            data["action"] = action
        if container is not None:
            data[event_type.value] = container
        return self.factory.post(
            self.path,
            data=data,
            content_type="application/json",
            headers={"X-GITHUB-EVENT": event_type.value},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_run_created(self, mock_metrics: Mock) -> None:
        """check_run action=created has no cell-side consumer and is dropped."""
        self.get_integration()
        request = self._post_check_event(action="created")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={"event_type": "check_run", "action": "created", "reason": "unconsumed_action"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_forwards_check_run_completed(self) -> None:
        # An own-repo PR is the only shape of completed check that reaches a mailbox.
        integration = self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 123}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}:23:check_run",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_forwards_check_run_rerequested(self) -> None:
        integration = self.get_integration()
        request = self._post_check_event(action="rerequested")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}:23:check_run",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_forwards_check_run_requested_action(self) -> None:
        integration = self.get_integration()
        request = self._post_check_event(action="requested_action")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}:23:check_run",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_run_bogus_action(self, mock_metrics: Mock) -> None:
        """Unrecognized actions are dropped with a bounded 'unknown' metric tag."""
        self.get_integration()
        request = self._post_check_event(action="attacker-controlled-junk")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={"event_type": "check_run", "action": "unknown", "reason": "unconsumed_action"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_run_missing_action(self, mock_metrics: Mock) -> None:
        self.get_integration()
        request = self._post_check_event(action=None)
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={"event_type": "check_run", "action": "unknown", "reason": "unconsumed_action"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_run_non_string_action(self, mock_metrics: Mock) -> None:
        """A non-string (unhashable) action must not raise; it is dropped as 'unknown'."""
        self.get_integration()
        request = self._post_check_event(action={"nested": "junk"})
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={"event_type": "check_run", "action": "unknown", "reason": "unconsumed_action"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_suite_requested(self, mock_metrics: Mock) -> None:
        """check_suite action=requested has no cell-side consumer and is dropped."""
        self.get_integration()
        request = self._post_check_event(
            action="requested", event_type=GithubWebhookType.CHECK_SUITE
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={
                "event_type": "check_suite",
                "action": "requested",
                "reason": "unconsumed_action",
            },
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_suite_rerequested(self, mock_metrics: Mock) -> None:
        self.get_integration()
        request = self._post_check_event(
            action="rerequested", event_type=GithubWebhookType.CHECK_SUITE
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={
                "event_type": "check_suite",
                "action": "rerequested",
                "reason": "unconsumed_action",
            },
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_suite_bogus_action(self, mock_metrics: Mock) -> None:
        """Unrecognized actions are dropped with a bounded 'unknown' metric tag."""
        self.get_integration()
        request = self._post_check_event(
            action="attacker-controlled-junk", event_type=GithubWebhookType.CHECK_SUITE
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={"event_type": "check_suite", "action": "unknown", "reason": "unconsumed_action"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_forwards_check_suite_completed(self) -> None:
        # Needs an own-repo PR to survive the drop, as for check_run.
        integration = self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 123}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"github:{integration.id}:23:check_suite",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    @override_options({SHED_INBOUND_KILLSWITCH: [{"provider": "github"}]})
    def test_shed_inbound_is_not_counted_as_forwarded(self, mock_metrics: Mock) -> None:
        self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 123}},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert response["Retry-After"] == "60"
        assert_no_webhook_payloads()
        forwarded_calls = [
            call
            for call in mock_metrics.incr.call_args_list
            if call.args and call.args[0] == "github.webhook.forwarded_event"
        ]
        assert forwarded_calls == []

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.metrics")
    @override_options({SHED_INBOUND_KILLSWITCH: [{"integration_id": "12345"}]})
    def test_shed_condition_ignored_counted_once_per_webhook(self, mock_metrics: Mock) -> None:
        """GitHub checks the shed twice per request: once ahead of its own counters and
        again inside get_response_from_webhookpayload. An ignored condition is a property
        of the config, so it must be counted per webhook, not per check."""
        self.get_integration()
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
        ignored_calls = [
            call
            for call in mock_metrics.incr.call_args_list
            if call.args and call.args[0] == "hybridcloud.webhookpayload.shed_condition_ignored"
        ]
        assert len(ignored_calls) == 1

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_forwarded_event_metric_omits_action_when_unfiltered(self, mock_metrics: Mock) -> None:
        """Event types with no action allowlist are not tagged by action, which would
        otherwise be an unbounded value read off an unverified body."""
        self.get_integration()
        request = self.factory.post(
            self.path,
            data={"installation": {"id": "1"}, "repository": {"id": 123}, "action": "whatever"},
            content_type="application/json",
            headers={"X-GITHUB-EVENT": GithubWebhookType.PUSH.value},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_metrics.incr.assert_any_call(
            "github.webhook.forwarded_event",
            tags={"event_type": "push"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_forwarded_event_metric_missing_event_header(self, mock_metrics: Mock) -> None:
        self.get_integration()
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
        mock_metrics.incr.assert_any_call(
            "github.webhook.forwarded_event",
            tags={"event_type": "unknown"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_forwarded_event_metric_own_repo_pull_request(self, mock_metrics: Mock) -> None:
        """A check whose PR entry is based in this repo is work the cell will do."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 123}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_metrics.incr.assert_any_call(
            "github.webhook.forwarded_event",
            tags={"event_type": "check_run", "action": "completed", "has_own_repo_pr": "true"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: False})
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_forwarded_event_metric_foreign_repo_pull_request(self, mock_metrics: Mock) -> None:
        """GitHub also lists PRs that merely share a head sha but live in another repo;
        the cell skips those, so they count as no work. Reachable only with the drop
        disabled -- with it on, these are dropped before the forward."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 456}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_metrics.incr.assert_any_call(
            "github.webhook.forwarded_event",
            tags={"event_type": "check_run", "action": "completed", "has_own_repo_pr": "false"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: False})
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_forwarded_event_metric_no_pull_requests(self, mock_metrics: Mock) -> None:
        """The common case for CI on a non-PR commit: an empty pull_requests array.
        Reachable only with the drop disabled."""
        self.get_integration()
        request = self._post_check_event(action="completed", container={"pull_requests": []})
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_metrics.incr.assert_any_call(
            "github.webhook.forwarded_event",
            tags={"event_type": "check_run", "action": "completed", "has_own_repo_pr": "false"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_forwarded_event_metric_check_suite_pull_requests(self, mock_metrics: Mock) -> None:
        """check_suite lists its PRs under its own payload member."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 123}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_metrics.incr.assert_any_call(
            "github.webhook.forwarded_event",
            tags={"event_type": "check_suite", "action": "completed", "has_own_repo_pr": "true"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_forwarded_event_metric_omits_pr_tag_for_other_actions(
        self, mock_metrics: Mock
    ) -> None:
        """Only the completed action has a consumer that reads pull_requests."""
        self.get_integration()
        request = self._post_check_event(action="rerequested")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_metrics.incr.assert_any_call(
            "github.webhook.forwarded_event",
            tags={"event_type": "check_run", "action": "rerequested"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: False})
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_forwarded_event_metric_malformed_pull_requests(self, mock_metrics: Mock) -> None:
        """The body is unverified here, so junk in place of any nested member must not
        raise — it just means no pull request was matched. Pinned off to assert the
        forward; the drop path has its own test."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={"pull_requests": ["junk", {"base": "junk"}, {"base": {"repo": []}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_metrics.incr.assert_any_call(
            "github.webhook.forwarded_event",
            tags={"event_type": "check_run", "action": "completed", "has_own_repo_pr": "false"},
        )

    # --- Dropping check_run.completed with no pull request based in its own repo ---
    #
    # The option is off by default, so each of these sets it explicitly; the
    # default-off behaviour is its own test below.

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_run_completed_with_only_foreign_repo_prs(self, mock_metrics: Mock) -> None:
        """The case the drop exists for: GitHub matched a PR by head sha, but it is
        based in another repo, so the cell's _prs_from_check_payload skips it."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 456}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={"event_type": "check_run", "action": "completed", "reason": "no_own_repo_pr"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_drops_check_run_completed_with_no_pull_requests(self) -> None:
        """CI on a commit with no PR at all — the bulk of the reclaimed volume."""
        self.get_integration()
        request = self._post_check_event(action="completed", container={"pull_requests": []})
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_forwards_check_run_completed_with_own_repo_pr(self) -> None:
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 123}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 1

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_forwards_check_run_completed_when_a_later_entry_is_own_repo(self) -> None:
        """A foreign entry ahead of ours must not short-circuit the scan."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={
                "pull_requests": [
                    {"number": 7, "base": {"repo": {"id": 456}}},
                    {"number": 8, "base": {"repo": {"id": 123}}},
                ]
            },
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 1

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    @patch("sentry.middleware.integrations.parsers.github.metrics")
    def test_drops_check_suite_completed_with_only_foreign_repo_prs(
        self, mock_metrics: Mock
    ) -> None:
        """Both check_suite consumers skip a definitively foreign entry: pr_metrics'
        _prs_from_check_payload and Seer's resolve_check_suite_autofix_run."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 456}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()
        mock_metrics.incr.assert_any_call(
            "github.webhook.drop_unprocessed_event",
            tags={"event_type": "check_suite", "action": "completed", "reason": "no_own_repo_pr"},
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_drops_check_suite_completed_with_no_pull_requests(self) -> None:
        """An empty list is a no-op for both consumers, and is most of the volume."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": []},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_forwards_check_suite_completed_with_own_repo_pr(self) -> None:
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": [{"number": 7, "base": {"repo": {"id": 123}}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 1

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_drops_check_suite_completed_with_malformed_pull_requests(self) -> None:
        """Junk resolves to no base.repo, so no consumer can place it either."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": ["junk", {"base": "junk"}, {"base": {"repo": []}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_drops_check_run_completed_with_an_unplaceable_pr(self) -> None:
        """An entry with no base.repo cannot be placed, and every consumer of these
        actions skips it — pr_metrics because a number is scoped to its base repo,
        Seer's suite resolver to stay aligned with that."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={"pull_requests": [{"number": 7}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_drops_check_suite_completed_with_an_unplaceable_pr(self) -> None:
        """Same rule for check_suite: its second consumer resolves by global id, but
        skips the unplaceable entry so both consumers act on the same set."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": [{"number": 7}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_check_suite_completed_without_own_repo_pr_is_dropped_by_default(self) -> None:
        """Same for check_suite."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": []},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: False})
    def test_check_suite_completed_without_own_repo_pr_is_forwarded_when_disabled(self) -> None:
        """The kill switch, for check_suite."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            event_type=GithubWebhookType.CHECK_SUITE,
            container={"pull_requests": []},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 1

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_check_run_rerequested_is_never_dropped_by_the_pr_predicate(self) -> None:
        """Only completed resolves PRs from the payload; rerequested is keyed off the
        check run's own id, so an empty pull_requests must still be forwarded."""
        self.get_integration()
        request = self._post_check_event(action="rerequested", container={"pull_requests": []})
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 1

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: True})
    def test_drops_check_run_completed_with_malformed_pull_requests(self) -> None:
        """The body is unverified here. Junk resolves to no own-repo PR, and dropping
        is the safe reading: the cell could not have resolved a PR from it either."""
        self.get_integration()
        request = self._post_check_event(
            action="completed",
            container={"pull_requests": ["junk", {"base": "junk"}, {"base": {"repo": []}}]},
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_check_run_completed_without_own_repo_pr_is_dropped_by_default(self) -> None:
        """An unset option drops: the registered default carries the drop."""
        self.get_integration()
        request = self._post_check_event(action="completed", container={"pull_requests": []})
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    @override_options({DROP_NO_OWN_REPO_PR_OPTION: False})
    def test_check_run_completed_without_own_repo_pr_is_forwarded_when_disabled(self) -> None:
        """The kill switch: setting the option false forwards instead of dropping."""
        self.get_integration()
        request = self._post_check_event(action="completed", container={"pull_requests": []})
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 1


@control_silo_test
class GithubRequestParserTypeRoutingTest(GithubRequestParserTest):
    """
    Test fixture that runs the routing tests with header-based routing enabled.
    """

    @pytest.fixture(autouse=True)
    def setup(self):
        with override_options({"github.webhook-type-routing.enabled": True}):
            yield
