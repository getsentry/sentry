from __future__ import annotations

import logging
from collections.abc import Collection
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from dateutil.parser import parse as parse_date
from django.db.models import Q

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration

if TYPE_CHECKING:
    from sentry.integrations.services.integration import RpcIntegration

logger = logging.getLogger(__name__)


def parse_provider_event_time(raw: str | None) -> datetime | None:
    """
    Read the provider's own timestamp for an assignment change, or None if it gave us none.

    Each webhook handler passes its provider's field for this (`issue.updated_at`,
    `object_attributes.updated_at`, `issue.fields.updated`) so the sync stays free of
    per-provider payload shapes.
    """
    if not isinstance(raw, str) or not raw.strip():
        return None

    try:
        parsed = parse_date(raw)
    except (ValueError, OverflowError):
        logger.warning("sync_assignee_inbound.unparsable_event_time", extra={"raw_value": raw})
        return None

    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def lock_and_get_stale_organization_ids(
    integration: RpcIntegration | Integration,
    external_issue_key: str | None,
    organization_ids: Collection[int],
    event_updated_at: datetime | None,
) -> set[int]:
    """
    Lock this issue's rows and return the organizations already past ``event_updated_at``.

    Must be called inside a transaction, and the caller must finish its assignment work and
    its watermark write before that transaction commits. The lock is what makes
    check-then-assign atomic against a concurrent delivery for the same issue: without it
    both deliveries read the pre-write watermark and both pass the check, so the older
    one's assignment can land last while its own watermark write is correctly rejected,
    leaving the stored assignee and the watermark permanently disagreeing. Contention is
    per issue, between deliveries that have to serialize anyway.

    Every candidate row is locked, not only the stale ones — the rows that pass the check
    are precisely the ones the caller is about to write against, so those are the rows a
    competing delivery has to be kept out of. Rows are locked in a fixed order so two
    deliveries covering the same set cannot deadlock against each other.

    Both sides come from the provider's clock, so delivery latency doesn't enter into it.
    Equal timestamps are not stale: every provider hands us the issue's full assignee
    snapshot rather than a delta, so re-applying a same-instant event is idempotent when it
    is a redelivery and correct-by-recency when it is a distinct change the provider's
    timestamp resolution can't separate. Only a strictly older event is dropped.

    A missing key or timestamp yields an empty set, so the guard never suppresses a sync it
    has no evidence about.
    """
    if external_issue_key is None or event_updated_at is None or not organization_ids:
        return set()

    rows = (
        ExternalIssue.objects.filter(
            organization_id__in=organization_ids,
            integration_id=integration.id,
            key=external_issue_key,
        )
        .order_by("id")
        .select_for_update()
        .values_list("organization_id", "provider_assignee_updated_at")
    )

    return {
        organization_id
        for organization_id, provider_assignee_updated_at in rows
        if provider_assignee_updated_at is not None
        and provider_assignee_updated_at > event_updated_at
    }


def record_provider_assignee_updated_at(
    integration: RpcIntegration | Integration,
    external_issue_key: str | None,
    organization_ids: Collection[int],
    event_updated_at: datetime | None,
) -> None:
    """
    Advance the watermark for the issues this event was applied to.

    Conditional rather than a plain write so the column can only move forwards. A caller
    holding the row lock cannot observe the conditional failing; it is what keeps the
    watermark monotonic for any caller that does not.
    """
    if external_issue_key is None or event_updated_at is None or not organization_ids:
        return

    ExternalIssue.objects.filter(
        organization_id__in=organization_ids,
        integration_id=integration.id,
        key=external_issue_key,
    ).filter(
        Q(provider_assignee_updated_at__isnull=True)
        | Q(provider_assignee_updated_at__lt=event_updated_at)
    ).update(provider_assignee_updated_at=event_updated_at)
