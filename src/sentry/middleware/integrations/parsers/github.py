from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.github.webhook import (
    GitHubIntegrationsWebhookEndpoint,
    get_github_external_id,
)
from sentry.integrations.github.webhook_types import (
    _CONTROL_ONLY_EVENTS,
    CELL_PROCESSED_CHECK_RUN_ACTIONS,
    CELL_PROCESSED_GITHUB_EVENTS,
    GITHUB_CHECK_RUN_ACTIONS,
    GITHUB_WEBHOOK_TYPE_HEADER,
    GithubWebhookType,
)
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.silo.base import control_silo_function
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class GithubRequestParser(BaseRequestParser):
    provider = IntegrationProviderSlug.GITHUB.value
    webhook_identifier = WebhookProviderIdentifier.GITHUB
    webhook_endpoint: Any = GitHubIntegrationsWebhookEndpoint
    """Overridden in GithubEnterpriseRequestParser"""

    def _get_external_id(self, event: Mapping[str, Any]) -> str | None:
        """Overridden in GithubEnterpriseRequestParser"""
        return get_github_external_id(event)

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        """Hash on repository ID to distribute webhooks across sub-mailboxes.

        GitHub webhook payloads include repository.id for most event types.
        Installation events are routed to control silo and don't reach this path.
        """
        repository = data.get("repository")
        if isinstance(repository, dict):
            repo_id = repository.get("id")
            if isinstance(repo_id, int):
                return repo_id
        return None

    def get_mailbox_identifier(
        self, integration: RpcIntegration | Integration, data: dict[str, Any]
    ) -> str:
        """Distribute webhooks across sub-mailboxes by repository ID and event type.

        Bypasses the rate-limit auto-switch used by the base class so GitHub webhooks
        are always bucketed.
        """
        base = self._build_bucketed_identifier(integration, data)
        event_type = self.request.META.get(GITHUB_WEBHOOK_TYPE_HEADER)
        if event_type:
            return f"{base}:{event_type}"
        return base

    def should_route_to_control_silo(
        self, parsed_event: Mapping[str, Any], request: HttpRequest
    ) -> bool:
        return request.META.get(GITHUB_WEBHOOK_TYPE_HEADER) in _CONTROL_ONLY_EVENTS

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        if not self.is_json_request():
            return None
        try:
            event = orjson.loads(self.request.body)
        except orjson.JSONDecodeError:
            return None
        external_id = self._get_external_id(event=event)
        if not external_id:
            return None
        return Integration.objects.filter(external_id=external_id, provider=self.provider).first()

    def get_response(self) -> HttpResponseBase:
        """
        Orchestrates GitHub webhook routing across Sentry's multi-service architecture.

        Handles installation events in control silo and distributes webhooks to appropriate
        cell silos based on organization locations.
        """
        webhook_endpoints = (
            self.webhook_endpoint
            if isinstance(self.webhook_endpoint, tuple)
            else (self.webhook_endpoint,)
        )
        if self.view_class not in webhook_endpoints:
            return self.get_response_from_control_silo()

        try:
            event = orjson.loads(self.request.body)
        except orjson.JSONDecodeError:
            return HttpResponse(status=400)

        if self.should_route_to_control_silo(parsed_event=event, request=self.request):
            return self.get_response_from_control_silo()

        try:
            integration = self.get_integration_from_request()
            if not integration:
                return self.get_default_missing_integration_response()

            cells = self.get_cells_from_organizations()
        except Integration.DoesNotExist:
            return self.get_default_missing_integration_response()

        if len(cells) == 0:
            return self.get_default_missing_integration_response()

        github_event = self.request.META.get(GITHUB_WEBHOOK_TYPE_HEADER)

        # Only drop when we have a known unprocessed event type. Missing or empty
        # X-GitHub-Event is malformed; let the request be forwarded so the cell
        # returns 400 and GitHub is notified of the delivery failure.
        if github_event and github_event not in CELL_PROCESSED_GITHUB_EVENTS:
            metrics.incr(
                "github.webhook.drop_unprocessed_event",
                tags={"event_type": github_event or "unknown"},
            )
            return HttpResponse(status=202)

        # check_run is by far the highest-volume event type and only some actions
        # have a cell-side consumer (see CELL_PROCESSED_CHECK_RUN_ACTIONS); drop the
        # rest, most notably "created" which is roughly half of all deliveries.
        if github_event == GithubWebhookType.CHECK_RUN:
            action = event.get("action")
            if not (isinstance(action, str) and action in CELL_PROCESSED_CHECK_RUN_ACTIONS):
                # The body is not signature-verified until it reaches the cell, so
                # only known check_run actions may be tagged verbatim to keep tag
                # cardinality bounded.
                metrics.incr(
                    "github.webhook.drop_unprocessed_event",
                    tags={
                        "event_type": github_event,
                        "action": (
                            action
                            if isinstance(action, str) and action in GITHUB_CHECK_RUN_ACTIONS
                            else "unknown"
                        ),
                    },
                )
                return HttpResponse(status=202)

        response = self.get_response_from_webhookpayload(
            cells=cells,
            identifier=self.get_mailbox_identifier(integration, event),
            integration_id=integration.id,
        )

        return response
