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
    """Parse the provider's own timestamp for an assignment change, or None if it gave us none."""
    if not isinstance(raw, str) or not raw.strip():
        return None

    try:
        parsed = parse_date(raw)
    except (ValueError, OverflowError):
        logger.warning("sync_assignee_inbound.unparsable_event_time", extra={"raw_value": raw})
        return None

    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def get_stale_organization_ids(
    integration: RpcIntegration | Integration,
    external_issue_key: str | None,
    organization_ids: Collection[int],
    event_updated_at: datetime | None,
    *,
    lock: bool,
) -> set[int]:
    """
    Return the organizations whose issue is already past ``event_updated_at``.

    With ``lock`` this must be called inside a transaction, and the lock is held until
    commit so a concurrent delivery for the same issue cannot interleave between this check
    and the caller's assignment write. All candidate rows are locked (in ``id`` order, to
    avoid deadlocks), since the rows that pass the check are the ones about to be written.

    Only strictly older events are stale: payloads carry the full assignee snapshot, so
    re-applying an equal-timestamp event is safe. Missing key or timestamp yields an empty
    set — the guard never suppresses a sync it has no evidence about.
    """
    if external_issue_key is None or event_updated_at is None or not organization_ids:
        return set()

    rows = ExternalIssue.objects.filter(
        organization_id__in=organization_ids,
        integration_id=integration.id,
        key=external_issue_key,
    ).order_by("id")
    if lock:
        rows = rows.select_for_update()

    return {
        organization_id
        for organization_id, provider_assignee_updated_at in rows.values_list(
            "organization_id", "provider_assignee_updated_at"
        )
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

    Conditional so the column can only move forwards, even for callers not holding the
    row lock.
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
