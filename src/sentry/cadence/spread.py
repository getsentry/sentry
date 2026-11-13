"""Spreads each trigger type's firings over its spread window; see `TriggerHandler`."""

from __future__ import annotations

import hashlib
from datetime import timedelta

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType
from sentry.cadence.registry import trigger_type_registry


def spread_window_for(trigger_type: str, min_gap: timedelta) -> timedelta:
    """
    The spread window of a trigger of `trigger_type` whose scheduled times are at least
    `min_gap` apart. Raises NoRegistrationExistsError if the trigger type isn't registered.
    """
    handler = trigger_type_registry.get(ScheduledTriggerType(trigger_type))
    return min(handler.spread_window, min_gap / 2)


def fire_offset(
    *, organization_id: int, trigger_type: str, target_id: int, min_gap: timedelta
) -> timedelta:
    """
    How long after its scheduled time a trigger fires, in whole seconds within its spread
    window. Always the same for the same trigger and window.
    """
    window_seconds = int(spread_window_for(trigger_type, min_gap).total_seconds())
    if window_seconds == 0:
        return timedelta(0)
    # Python's hash() varies between processes, so use a stable hash.
    key = f"{organization_id}:{trigger_type}:{target_id}".encode()
    digest = hashlib.blake2b(key, digest_size=8).digest()
    return timedelta(seconds=int.from_bytes(digest, "big") % window_seconds)


def offset_of(trigger: ScheduledTrigger) -> timedelta:
    return fire_offset(
        organization_id=trigger.organization_id,
        trigger_type=trigger.trigger_type,
        target_id=trigger.target_id,
        min_gap=timedelta(seconds=trigger.min_gap_seconds),
    )
