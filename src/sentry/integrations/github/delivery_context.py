"""
How a cell's GitHub webhook handler uses the routing context control signed onto
the delivery, so it can skip asking control which organizations the installation
belongs to. See `sentry.hybridcloud.webhook_delivery_context` for the context itself.
"""

from __future__ import annotations

import enum
import logging
from collections.abc import Collection
from dataclasses import dataclass

from django.http import HttpRequest

from sentry import options
from sentry.hybridcloud.webhook_delivery_context import (
    DeliveryContextRejection,
    verify_webhook_delivery_context,
)
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    WEBHOOK_DELIVERY_CONTEXT_HEADER,
    WEBHOOK_DELIVERY_CONTEXT_SIGNATURE_HEADER,
)
from sentry.types.cell import get_local_cell
from sentry.utils import metrics

logger = logging.getLogger("sentry.webhooks")

DELIVERY_CONTEXT_MODE_OPTION = "github.webhook.delivery-context.mode"
DELIVERY_CONTEXT_MAX_AGE_OPTION = "github.webhook.delivery-context.max-age-seconds"


class DeliveryContextMode(enum.StrEnum):
    OFF = "off"
    SHADOW = "shadow"
    """Resolve the integration through control as before, and report whether the
    context would have given the same answer."""
    ENFORCE = "enforce"
    """Act on the context and skip the lookup."""


class DeliveryContextOutcome(enum.StrEnum):
    ABSENT = "absent"
    IDENTITY_MISMATCH = "identity_mismatch"
    EVENT_MISMATCH = "event_mismatch"
    USED = "used"
    NO_LOCAL_REPO = "no_local_repo"
    REPO_INTEGRATION_MISMATCH = "repo_integration_mismatch"
    SHADOW_MISMATCH = "shadow_mismatch"
    SHADOW_WOULD_USE = "shadow_would_use"
    SHADOW_NO_LOCAL_REPO = "shadow_no_local_repo"
    SHADOW_REPO_INTEGRATION_MISMATCH = "shadow_repo_integration_mismatch"


# Outcomes that are routine at full volume. Everything else means a context was
# refused or disagreed with control, and is rare enough to count in full.
_SAMPLED_OUTCOMES = frozenset(
    {
        DeliveryContextOutcome.ABSENT,
        DeliveryContextOutcome.USED,
        DeliveryContextOutcome.SHADOW_WOULD_USE,
    }
)


@dataclass(frozen=True)
class GitHubDeliveryContext:
    """A context that passed every check, and what the handler should do with it."""

    integration_id: int
    organization_ids: frozenset[int]
    enforce: bool
    """False in shadow mode."""


def record_delivery_context_outcome(
    outcome: DeliveryContextOutcome | DeliveryContextRejection, github_event: GithubWebhookType
) -> None:
    tags = {"outcome": outcome.value, "event_type": github_event.value}
    if outcome in _SAMPLED_OUTCOMES:
        metrics.incr("github.webhook.delivery_context", tags=tags)
    else:
        metrics.incr("github.webhook.delivery_context", tags=tags, sample_rate=1.0)


def resolve_delivery_context(
    request: HttpRequest,
    *,
    external_id: str | None,
    github_event: GithubWebhookType,
    github_delivery_id: str | None,
) -> GitHubDeliveryContext | None:
    """The delivery context for a GitHub.com webhook this cell may act on, or None
    to resolve the integration through control.

    Call only after GitHub's signature on the body has been verified, and only for a
    handler that opted in. `external_id` is the installation id read out of that body.
    """
    # Only a cell receives queued deliveries. Control handles its own events directly,
    # and a monolith has no control silo to have signed anything.
    if SiloMode.get_current_mode() != SiloMode.CELL:
        return None
    mode = options.get(DELIVERY_CONTEXT_MODE_OPTION)
    if mode not in (DeliveryContextMode.SHADOW, DeliveryContextMode.ENFORCE):
        return None

    encoded = request.headers.get(WEBHOOK_DELIVERY_CONTEXT_HEADER)
    if encoded is None:
        record_delivery_context_outcome(DeliveryContextOutcome.ABSENT, github_event)
        return None

    context = verify_webhook_delivery_context(
        path=request.get_full_path(),
        request_body=request.body,
        encoded=encoded,
        signature=request.headers.get(WEBHOOK_DELIVERY_CONTEXT_SIGNATURE_HEADER),
        cell_name=get_local_cell().name,
        max_age_seconds=options.get(DELIVERY_CONTEXT_MAX_AGE_OPTION),
    )
    if isinstance(context, DeliveryContextRejection):
        record_delivery_context_outcome(context, github_event)
        return None

    # GitHub Enterprise has its own endpoint and never gets here. A GitHub Enterprise
    # context is refused anyway: its installations are keyed by host, and the
    # customer holds the secret that signs the body.
    if (
        context.provider != IntegrationProviderSlug.GITHUB.value
        or external_id is None
        or context.external_id != str(external_id)
    ):
        record_delivery_context_outcome(DeliveryContextOutcome.IDENTITY_MISMATCH, github_event)
        return None
    if context.event_type != github_event.value or context.delivery_id != github_delivery_id:
        record_delivery_context_outcome(DeliveryContextOutcome.EVENT_MISMATCH, github_event)
        return None

    return GitHubDeliveryContext(
        integration_id=context.integration_id,
        organization_ids=context.organization_ids,
        enforce=mode == DeliveryContextMode.ENFORCE,
    )


def delivery_context_fallback(
    repos: Collection[Repository], integration_id: int
) -> DeliveryContextOutcome | None:
    """Why the repositories a webhook matched can't be handled on the context alone,
    or None when they can.

    The context is as old as the delivery. These are the two signs that it no longer
    describes what is here, and each sends the delivery back to the lookup.
    """
    if not repos:
        # Creating or relinking a repository reads the integration itself.
        return DeliveryContextOutcome.NO_LOCAL_REPO
    if any(repo.integration_id != integration_id for repo in repos):
        # A repository on another integration, or on none: the organization unlinked
        # the installation or moved the repository since control read the context.
        return DeliveryContextOutcome.REPO_INTEGRATION_MISMATCH
    return None


_SHADOW_FALLBACKS = {
    DeliveryContextOutcome.NO_LOCAL_REPO: DeliveryContextOutcome.SHADOW_NO_LOCAL_REPO,
    DeliveryContextOutcome.REPO_INTEGRATION_MISMATCH: (
        DeliveryContextOutcome.SHADOW_REPO_INTEGRATION_MISMATCH
    ),
}


def shadow_delivery_context_outcome(
    context: GitHubDeliveryContext,
    *,
    integration_id: int,
    organization_ids: Collection[int],
    local_organization_ids: Collection[int],
    repos: Collection[Repository],
) -> DeliveryContextOutcome:
    """What acting on `context` would have done, given what the lookup returned.

    `organization_ids` is every organization the lookup returned and
    `local_organization_ids` the ones this cell has. Only the local ones decide what
    the handler does, so only they are compared.
    """
    lookup_local = frozenset(local_organization_ids)
    context_local = lookup_local
    if context.organization_ids != frozenset(organization_ids):
        context_local = frozenset(
            Organization.objects.filter(id__in=context.organization_ids).values_list(
                "id", flat=True
            )
        )
    if context.integration_id != integration_id or context_local != lookup_local:
        logger.warning(
            "github.webhook.delivery_context.shadow_mismatch",
            extra={
                "integration_id": integration_id,
                "context_integration_id": context.integration_id,
                "context_only_organization_ids": sorted(context_local - lookup_local),
                "lookup_only_organization_ids": sorted(lookup_local - context_local),
            },
        )
        return DeliveryContextOutcome.SHADOW_MISMATCH

    fallback = delivery_context_fallback(repos, context.integration_id)
    if fallback is None:
        return DeliveryContextOutcome.SHADOW_WOULD_USE
    return _SHADOW_FALLBACKS[fallback]
