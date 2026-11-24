from __future__ import annotations

import logging
import time
from collections.abc import Mapping
from typing import Any

import orjson
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase

from sentry.constants import ObjectStatus
from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.hybridcloud.webhook_delivery_context import (
    DeliveryContextUnsigned,
    WebhookDeliveryContext,
    sign_webhook_delivery_context,
)
from sentry.integrations.github.check_payloads import references_own_repo_pull_request
from sentry.integrations.github.webhook import (
    GitHubIntegrationsWebhookEndpoint,
    get_github_external_id,
)
from sentry.integrations.github.webhook_types import (
    _CONTROL_ONLY_EVENTS,
    CELL_PROCESSED_ACTIONS,
    CELL_PROCESSED_GITHUB_EVENTS,
    GITHUB_WEBHOOK_TYPE_HEADER,
    ActionFilter,
)
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.options.rollout import in_random_rollout
from sentry.silo.base import control_silo_function
from sentry.silo.util import (
    WEBHOOK_DELIVERY_CONTEXT_HEADER,
    WEBHOOK_DELIVERY_CONTEXT_SIGNATURE_HEADER,
)
from sentry.types.cell import Cell
from sentry.utils import metrics

logger = logging.getLogger(__name__)

DELIVERY_CONTEXT_EMIT_RATE_OPTION = "github.webhook.delivery-context.emit-rate"

# The events whose cell handler can act on a delivery context. Read off the handlers
# so that control signs one for exactly the events a cell would use it on.
DELIVERY_CONTEXT_EVENTS = frozenset(
    event_type.value
    for event_type, handler in GitHubIntegrationsWebhookEndpoint._handlers.items()
    if handler.USES_DELIVERY_CONTEXT
)


def _bounded_action_tag(action: Any, action_filter: ActionFilter) -> str:
    """Metric tag for a webhook action, bounded to the actions GitHub documents.

    The body is not signature-verified until it reaches the cell, so an action that
    GitHub would not have sent — malformed, or attacker-supplied — must never reach
    a tag value verbatim.
    """
    if isinstance(action, str) and action in action_filter.known:
        return action
    return "unknown"


def _forwarded_event_tags(
    github_event: str | None,
    action: Any,
    action_filter: ActionFilter | None,
) -> dict[str, str]:
    """Tags for the counter of events that survive filtering and get stored.

    Read against ``github.webhook.drop_unprocessed_event`` to see what share of each
    event type control still forwards. ``action`` is tagged only for the event types
    that are action-filtered; on the rest the tag would be unbounded.
    """
    tags = {"event_type": github_event or "unknown"}
    if action_filter is None:
        return tags

    tags["action"] = _bounded_action_tag(action, action_filter)
    return tags


class GithubRequestParser(BaseRequestParser):
    provider = IntegrationProviderSlug.GITHUB.value
    webhook_identifier = WebhookProviderIdentifier.GITHUB
    webhook_endpoint: Any = GitHubIntegrationsWebhookEndpoint
    """Overridden in GithubEnterpriseRequestParser"""

    _emits_delivery_context = False
    """Decided once per request, before the routing lookups, so that a webhook that
    gets no context keeps the routing query it had."""
    _linked_organization_ids: frozenset[int] | None = None
    _delivery_context_issued_at: int | None = None

    def _get_external_id(self, event: Mapping[str, Any]) -> str | None:
        """Overridden in GithubEnterpriseRequestParser"""
        return get_github_external_id(event)

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        """Every event type that reaches a cell carries `repository.id`; installation
        events are handled on control and never get here."""
        return self.bucket_key_at(data, "repository", "id")

    def mailbox_event_type(self, data: Mapping[str, Any]) -> str | None:
        return self.request.META.get(GITHUB_WEBHOOK_TYPE_HEADER)

    def should_route_to_control_silo(
        self, parsed_event: Mapping[str, Any], request: HttpRequest
    ) -> bool:
        return request.META.get(GITHUB_WEBHOOK_TYPE_HEADER) in _CONTROL_ONLY_EVENTS

    def _should_emit_delivery_context(self, github_event: str | None) -> bool:
        """Whether this webhook is queued with a delivery context for the cell.

        GitHub.com only. GitHub Enterprise installations are keyed by host, and the
        customer holds the secret that signs the body the context is checked against.
        """
        return (
            self.provider == IntegrationProviderSlug.GITHUB.value
            and github_event in DELIVERY_CONTEXT_EVENTS
            and in_random_rollout(DELIVERY_CONTEXT_EMIT_RATE_OPTION)
        )

    def get_active_organization_ids(self, integration_id: int) -> list[int]:
        if not self._emits_delivery_context:
            return super().get_active_organization_ids(integration_id)

        # Routing wants the active links and the context wants every link, which is
        # what the cell handler would get from control. One query serves both. The
        # context is dated from before the read, so its age never understates it.
        self._delivery_context_issued_at = int(time.time())
        links = list(
            OrganizationIntegration.objects.filter(integration_id=integration_id).values_list(
                "organization_id", "status"
            )
        )
        self._linked_organization_ids = frozenset(organization_id for organization_id, _ in links)
        return [
            organization_id for organization_id, status in links if status == ObjectStatus.ACTIVE
        ]

    def _delivery_context_headers(
        self, integration: Integration, cells: list[Cell], github_event: str | None
    ) -> dict[str, str | None]:
        """The headers that carry the delivery context to the cell.

        Both names are always returned, set to None when there is no context to send,
        so that a copy the caller sent is never stored and replayed to the cell.
        """
        headers: dict[str, str | None] = {
            WEBHOOK_DELIVERY_CONTEXT_HEADER: None,
            WEBHOOK_DELIVERY_CONTEXT_SIGNATURE_HEADER: None,
        }
        if self._linked_organization_ids is None or self._delivery_context_issued_at is None:
            return headers

        signed = sign_webhook_delivery_context(
            WebhookDeliveryContext(
                provider=self.provider,
                external_id=integration.external_id,
                integration_id=integration.id,
                organization_ids=self._linked_organization_ids,
                cell_names=frozenset(cell.name for cell in cells),
                event_type=github_event,
                delivery_id=self.request.headers.get("X-GitHub-Delivery"),
                issued_at=self._delivery_context_issued_at,
            ),
            path=self.request.get_full_path(),
            request_body=self.request.body,
        )
        if isinstance(signed, DeliveryContextUnsigned):
            # The cell resolves the integration through control, as it always has.
            metrics.incr(
                "github.webhook.delivery_context.emit",
                tags={"outcome": signed.value},
                sample_rate=1.0,
            )
            return headers

        encoded, signature = signed
        headers[WEBHOOK_DELIVERY_CONTEXT_HEADER] = encoded
        headers[WEBHOOK_DELIVERY_CONTEXT_SIGNATURE_HEADER] = signature
        metrics.incr("github.webhook.delivery_context.emit", tags={"outcome": "signed"})
        return headers

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
        return Integration.objects.get_or_none(external_id=external_id, provider=self.provider)

    def _get_drop_response(
        self,
        github_event: str | None,
        event: Mapping[str, Any],
        action: Any,
        action_filter: ActionFilter | None,
    ) -> HttpResponse | None:
        """A 202 for a webhook no cell-side consumer reads, or None to keep routing it.

        Reads the event header and the request body and nothing else, which is what
        lets it run before the integration and cell lookups.
        """
        # Only drop when we have a known unprocessed event type. Missing or empty
        # X-GitHub-Event is malformed; let the request be forwarded so the cell
        # returns 400 and GitHub is notified of the delivery failure.
        if github_event and github_event not in CELL_PROCESSED_GITHUB_EVENTS:
            metrics.incr(
                "github.webhook.drop_unprocessed_event",
                tags={
                    "event_type": github_event or "unknown",
                    "reason": "unprocessed_event_type",
                },
            )
            return HttpResponse(status=202)

        # For the highest-volume event types, only some actions have a cell-side
        # consumer (see CELL_PROCESSED_ACTIONS); drop the rest.
        if action_filter is not None and not (
            isinstance(action, str) and action in action_filter.consumed
        ):
            metrics.incr(
                "github.webhook.drop_unprocessed_event",
                tags={
                    "event_type": github_event,
                    "action": _bounded_action_tag(action, action_filter),
                    "reason": "unconsumed_action",
                },
            )
            return HttpResponse(status=202)

        # A check payload whose `pull_requests` are all based in other repos is a
        # no-op for every consumer of these actions, so it never needs storing.
        if (
            action_filter is not None
            and action in action_filter.own_repo_pr_actions
            and not references_own_repo_pull_request(event, github_event or "")
        ):
            metrics.incr(
                "github.webhook.drop_unprocessed_event",
                tags={
                    "event_type": github_event,
                    "action": _bounded_action_tag(action, action_filter),
                    "reason": "no_own_repo_pr",
                },
            )
            return HttpResponse(status=202)

        return None

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

        github_event = self.request.META.get(GITHUB_WEBHOOK_TYPE_HEADER)
        action = event.get("action")
        action_filter = CELL_PROCESSED_ACTIONS.get(github_event or "")

        # Ahead of the lookups: a webhook no cell consumes should not pay to resolve them.
        drop_response = self._get_drop_response(github_event, event, action, action_filter)
        if drop_response is not None:
            return drop_response

        # A condition naming no integration_id sheds the whole provider, so it needs no
        # lookup. Break-glass for a flood should not wait on the queries below.
        shed_response = self.get_shed_response()
        if shed_response is not None:
            return shed_response

        self._emits_delivery_context = self._should_emit_delivery_context(github_event)

        try:
            integration = self.integration_for_request()
            if not integration:
                return self.get_default_missing_integration_response()

            cells = self.get_cells_from_organizations()
        except Integration.DoesNotExist:
            return self.get_default_missing_integration_response()

        if len(cells) == 0:
            return self.get_default_missing_integration_response()

        # The integration-scoped half. Ahead of the forwarded_event counter and the
        # mailbox lookup, so a shed webhook is neither counted as forwarded nor charged
        # for routing it will not use.
        shed_response = self.get_shed_response(integration_id=integration.id)
        if shed_response is not None:
            return shed_response

        metrics.incr(
            "github.webhook.forwarded_event",
            tags=_forwarded_event_tags(github_event, action, action_filter),
        )

        response = self.get_response_from_webhookpayload(
            cells=cells,
            mailbox=self.get_mailbox(integration, event),
            integration_id=integration.id,
            header_overrides=self._delivery_context_headers(integration, cells, github_event),
        )

        return response
