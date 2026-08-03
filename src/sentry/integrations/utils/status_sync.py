from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from dateutil.parser import parse as parse_date

logger = logging.getLogger(__name__)

# Key under which each provider's webhook handler stashes the provider-side timestamp of
# the status change an inbound sync payload describes. Normalizing at the edge keeps
# `sync_status_inbound` — shared by GitHub, GitLab, VSTS, Jira and Jira Server — free of
# per-provider payload shapes.
PROVIDER_EVENT_TIME_KEY = "provider_event_time"


def parse_provider_event_time(data: Mapping[str, Any]) -> datetime | None:
    """
    Read the provider-side timestamp a webhook handler attached to an inbound status event.

    Returns None when the payload carries no usable timestamp — payloads enqueued before
    this key existed, and providers that omit their own timestamp — which leaves the
    ordering guard inert rather than blocking the sync.
    """
    raw = data.get(PROVIDER_EVENT_TIME_KEY)
    if not isinstance(raw, str) or not raw.strip():
        return None

    try:
        parsed = parse_date(raw)
    except (ValueError, OverflowError):
        logger.warning("sync_status_inbound.unparsable_event_time", extra={"raw_value": raw})
        return None

    # Providers report UTC or an explicit offset; treat a bare timestamp as UTC so the
    # comparison never comes down to naive-vs-aware.
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def is_stale_status_event(last_event_time: datetime | None, event_time: datetime | None) -> bool:
    """
    Whether an inbound status event describes a change the provider made no later than the
    newest one we have already processed for the same issue.

    Both timestamps come from the provider's own clock, so the comparison is unaffected by
    how long delivery took. Equal timestamps count as stale: `last_event_time` records an
    event we already applied, so an event that is not strictly newer is either that same
    event redelivered, or indistinguishable from it at the resolution the provider reports.
    Applying it again would re-run the sync on top of whatever happened in between —
    including a resolution a human made in Sentry.

    Returns False whenever either side is missing, so the guard cannot suppress a sync it
    has no evidence about.
    """
    if last_event_time is None or event_time is None:
        return False
    return event_time <= last_event_time
