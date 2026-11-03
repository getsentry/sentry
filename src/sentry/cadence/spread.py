"""Spreads each trigger type's runs over its spread window; see `register_trigger_action`."""

from __future__ import annotations

import hashlib
from datetime import timedelta

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType
from sentry.cadence.registry import trigger_type_registry


def spread_window_for(trigger_type: str, min_gap: timedelta) -> timedelta:
    """
    The spread window of a schedule of `trigger_type` whose runs are at least `min_gap`
    apart. Raises NoRegistrationExistsError if the trigger type isn't registered.
    """
    registration = trigger_type_registry.get(ScheduledTriggerType(trigger_type))
    return min(registration.spread_window, min_gap / 2)


def run_offset(
    *, organization_id: int, trigger_type: str, target_id: int, min_gap: timedelta
) -> timedelta:
    """
    How long after its scheduled time a schedule's runs happen, in whole seconds within its
    spread window. Always the same for the same schedule and window.
    """
    window_seconds = int(spread_window_for(trigger_type, min_gap).total_seconds())
    if window_seconds == 0:
        return timedelta(0)
    # Python's hash() varies between processes, so use a stable hash.
    key = f"{organization_id}:{trigger_type}:{target_id}".encode()
    digest = hashlib.blake2b(key, digest_size=8).digest()
    return timedelta(seconds=int.from_bytes(digest, "big") % window_seconds)


def offset_of(trigger: ScheduledTrigger) -> timedelta:
    return run_offset(
        organization_id=trigger.organization_id,
        trigger_type=trigger.trigger_type,
        target_id=trigger.target_id,
        min_gap=timedelta(seconds=trigger.min_gap_seconds),
    )
