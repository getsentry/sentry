from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase

from sentry import options
from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
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
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.silo.base import control_silo_function
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


def _bounded_action_tag(action: Any, action_filter: ActionFilter) -> str:
    """Metric tag for a webhook action, bounded to the actions GitHub documents.

    The body is not signature-verified until it reaches the cell, so an action that
    GitHub would not have sent — malformed, or attacker-supplied — must never reach
    a tag value verbatim.
    """
    if isinstance(action, str) and action in action_filter.known:
        return action
    return "unknown"


def _references_own_repo_pull_request(
    event: Mapping[str, Any], container_key: str, *, unplaceable_is_work: bool = False
) -> bool:
    """Whether a check payload references a pull request in the webhook's own repo.

    ``pull_requests`` can list PRs that live in *other* repositories, and the cell's
    ``_prs_from_check_payload`` resolves only entries whose ``base.repo`` is the repo
    the webhook is for — a payload carrying none of those is a no-op there. Both
    sides of that comparison are in the payload, so control can decide without the
    cell's database.

    ``repo.external_id`` is the string form of the payload's ``repository.id``: the
    cell looks the row up by that value (``GitHubWebhook.__call__``), so comparing
    against the payload here is the same comparison the cell makes.

    ``unplaceable_is_work`` covers the entry that carries no ``base.repo.id`` at all.
    pr_metrics skips it; Seer's ``_is_foreign_base_repo`` keeps it, on the grounds
    that dropping one costs a real Autofix iteration. Set it for event types whose
    consumers disagree, so the drop stays a subset of *every* consumer's no-op set
    rather than just the strictest one's.

    Only ever used to *drop*, so it must not return True on a payload the cell would
    ignore — it is fine to be conservative, never to be optimistic.
    """
    repo_id = get_path(event, "repository", "id")
    if repo_id is None:
        return False

    refs = get_path(event, container_key, "pull_requests")
    if not isinstance(refs, list):
        return False

    for ref in refs:
        base_repo_id = get_path(ref, "base", "repo", "id")
        if base_repo_id is None:
            if unplaceable_is_work:
                return True
            continue
        if str(base_repo_id) == str(repo_id):
            return True
    return False


def _forwarded_event_tags(
    github_event: str | None,
    event: Mapping[str, Any],
    action: Any,
    action_filter: ActionFilter | None,
) -> dict[str, str]:
    """Tags for the counter of events that survive filtering and get stored.

    Read against ``github.webhook.drop_unprocessed_event`` to see what share of each
    event type control still forwards. ``action`` is tagged only for the event types
    that are action-filtered; on the rest the tag would be unbounded.
    """
    tags = {"event_type": github_event or "unknown"}
    if action_filter is None or github_event is None:
        return tags

    tags["action"] = _bounded_action_tag(action, action_filter)
    # The container holding "pull_requests" is named after the event itself, and
    # only the completed action has a cell-side consumer that reads it. Keyed off the
    # action rather than ``own_repo_pr_actions`` on purpose: this measures the share
    # an own-repo drop *could* reclaim, which stays worth having on the event types
    # where applying that drop is not safe.
    #
    # Deliberately the strict predicate, without ``unplaceable_is_work``, so the
    # series keeps one meaning across event types and stays comparable with the
    # measurement this drop was sized from. On an event type that sets that flag it
    # is therefore an upper bound: enabling the drop takes `false` to near zero, not
    # to zero, and the remainder is the unplaceable entries the drop preserves.
    if action == "completed":
        tags["has_own_repo_pr"] = (
            "true" if _references_own_repo_pull_request(event, github_event) else "false"
        )
    return tags


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
                tags={
                    "event_type": github_event or "unknown",
                    "reason": "unprocessed_event_type",
                },
            )
            return HttpResponse(status=202)

        # For the highest-volume event types, only some actions have a cell-side
        # consumer (see CELL_PROCESSED_ACTIONS); drop the rest.
        action = event.get("action")
        action_filter = CELL_PROCESSED_ACTIONS.get(github_event or "")
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
        # no-op for every consumer of these actions, so it never needs storing. This
        # predicate reads the unverified body rather than a header, so it stays behind
        # an option — see the register() call for why.
        if (
            action_filter is not None
            and action in action_filter.own_repo_pr_actions
            and options.get("hybridcloud.webhookpayload.github_drop_checks_without_own_repo_pr")
            and not _references_own_repo_pull_request(
                event,
                github_event or "",
                unplaceable_is_work=action_filter.unplaceable_pr_is_work,
            )
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

        metrics.incr(
            "github.webhook.forwarded_event",
            tags=_forwarded_event_tags(github_event, event, action, action_filter),
        )

        response = self.get_response_from_webhookpayload(
            cells=cells,
            identifier=self.get_mailbox_identifier(integration, event),
            integration_id=integration.id,
        )

        return response
