from __future__ import annotations

from collections.abc import Sequence

from sentry.telemetry_classifiers.constants import MAX_INPUT_CHARS
from sentry.telemetry_classifiers.types import Event, PreparedInput
from sentry.utils import json


def fit_events(events: Sequence[Event]) -> PreparedInput:
    """Keep the newest events whose serialized size fits in MAX_INPUT_CHARS, oldest first.

    Events are never cut, so the first event that doesn't fit ends the input; datasets keep single
    events small. The result has no events when even the newest one doesn't fit.
    """
    kept: list[Event] = []
    remaining = MAX_INPUT_CHARS
    for event in reversed(events):
        size = len(json.dumps(event))
        if size > remaining:
            break
        kept.append(event)
        remaining -= size

    kept.reverse()
    return PreparedInput(events=tuple(kept), truncated=len(kept) < len(events))
