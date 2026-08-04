from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from dateutil.parser import parse as parse_date

logger = logging.getLogger(__name__)

# Provider-side timestamp of the status change a payload describes. Each webhook handler
# normalizes its provider's own field into this key so `sync_status_inbound` stays free of
# per-provider payload shapes.
PROVIDER_EVENT_TIME_KEY = "provider_event_time"


def parse_provider_event_time(data: Mapping[str, Any]) -> datetime | None:
    """Read a payload's provider event time, or None if it carries no usable timestamp."""
    raw = data.get(PROVIDER_EVENT_TIME_KEY)
    if not isinstance(raw, str) or not raw.strip():
        return None

    try:
        parsed = parse_date(raw)
    except (ValueError, OverflowError):
        logger.warning("sync_status_inbound.unparsable_event_time", extra={"raw_value": raw})
        return None

    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def is_stale_status_event(last_event_time: datetime | None, event_time: datetime | None) -> bool:
    """
    Whether an event describes a change the provider made no later than one already applied.

    Both sides come from the provider's clock, so delivery latency doesn't enter into it.
    Equal counts as stale: an event that is not strictly newer is either the one already
    applied, redelivered, or indistinguishable from it at the provider's resolution, and
    re-running it would overwrite whatever happened in between — including a resolution a
    human made in Sentry.

    A missing timestamp yields False, so the guard never suppresses a sync it has no
    evidence about.
    """
    if last_event_time is None or event_time is None:
        return False
    return event_time <= last_event_time
