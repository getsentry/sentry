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


def get_stale_organization_ids(
    integration: RpcIntegration | Integration,
    external_issue_key: str | None,
    organization_ids: Collection[int],
    event_time: datetime | None,
) -> set[int]:
    """
    Organizations whose watermark already covers a change the provider made *after* this one.

    Both sides come from the provider's clock, so delivery latency doesn't enter into it.
    Equal timestamps are not stale: every provider hands us the issue's full assignee
    snapshot rather than a delta, so re-applying a same-instant event is idempotent when it
    is a redelivery and correct-by-recency when it is a distinct change the provider's
    timestamp resolution can't separate. Only a strictly older event is dropped.

    A missing key or timestamp yields an empty set, so the guard never suppresses a sync it
    has no evidence about.
    """
    if external_issue_key is None or event_time is None or not organization_ids:
        return set()

    return set(
        ExternalIssue.objects.filter(
            organization_id__in=organization_ids,
            integration_id=integration.id,
            key=external_issue_key,
            assignee_updated_at__gt=event_time,
        ).values_list("organization_id", flat=True)
    )


def record_provider_event_time(
    integration: RpcIntegration | Integration,
    external_issue_key: str | None,
    organization_ids: Collection[int],
    event_time: datetime | None,
) -> None:
    """
    Advance the watermark for the issues this event was applied to.

    Conditional rather than a plain write: concurrent deliveries both read the pre-existing
    watermark, and letting the older one land last would move it backwards.
    """
    if external_issue_key is None or event_time is None or not organization_ids:
        return

    ExternalIssue.objects.filter(
        organization_id__in=organization_ids,
        integration_id=integration.id,
        key=external_issue_key,
    ).filter(Q(assignee_updated_at__isnull=True) | Q(assignee_updated_at__lt=event_time)).update(
        assignee_updated_at=event_time
    )
