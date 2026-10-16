from __future__ import annotations

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
    contexts = event.data.get("contexts") or {}
    flags_context = contexts.get("flags") or {}
    values = flags_context.get("values") or []
    if not isinstance(values, list):
        return []

    return [
        EventFeatureFlag(flag=str(item["flag"]), result=_format_result(item.get("result")))
        for item in values
        if isinstance(item, dict) and item.get("flag") is not None
    ]
