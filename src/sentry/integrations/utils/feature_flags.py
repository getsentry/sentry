from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event, GroupEvent


@dataclass(frozen=True)
class EventFeatureFlag:
    flag: str
    result: str


def _format_result(result: Any) -> str:
    if isinstance(result, bool):
        return "true" if result else "false"
    return str(result)


def get_event_feature_flags(event: Event | GroupEvent) -> list[EventFeatureFlag]:
    """
    Return the feature flags evaluated before the event, as recorded by the SDK
    feature flag integrations in `contexts.flags.values`.

    This only extracts and normalizes the flags; formatting (and any size limits)
    is left to each integration's payload builder.
    """
    # Event data is user-controlled, so any level may be the wrong type. Return no
    # flags rather than raising, so the notification is still sent.
    contexts = event.data.get("contexts")
    if not isinstance(contexts, Mapping):
        return []
    flags_context = contexts.get("flags")
    if not isinstance(flags_context, Mapping):
        return []
    values = flags_context.get("values")
    if not isinstance(values, list):
        return []

    return [
        EventFeatureFlag(flag=str(item["flag"]), result=_format_result(item.get("result")))
        for item in values
        if isinstance(item, Mapping) and item.get("flag") is not None
    ]
