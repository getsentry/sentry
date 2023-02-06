from __future__ import annotations

from typing import Any, Mapping, Sequence

from sentry.eventstore.models import Event
from sentry.utils.glob import glob_match


def detect_sdk_crash(data: Event):
    event_id = data.get("event_id", None)
    if event_id is None:
        return
    return


def is_sdk_crash(frames: Sequence[Mapping[str, Any]]) -> bool:
    if not frames:
        return False

    last_frame = frames[-1]
    if last_frame is None:
        return False

    if glob_match(last_frame["function"], "?[[]Sentry*", ignorecase=True):
        return True

    return False
