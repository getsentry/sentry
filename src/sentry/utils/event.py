from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from time import time
from typing import TYPE_CHECKING, Any

from sentry.utils import metrics
from sentry.utils.safe import get_path

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event


def has_stacktrace(event_data: Mapping[str, Any]) -> bool:
    """
    Detects the presence of a stacktrace in event data.

    Ignores empty stacktraces, and stacktraces whose frame list is empty.
    """
    if event_data.get("stacktrace") and event_data["stacktrace"].get("frames"):
        return True

    exception_or_threads = event_data.get("exception") or event_data.get("threads")

    if not exception_or_threads:
        return False

    # Search for a stacktrace with frames, intentionally ignoring empty values because they're
    # not helpful
    for value in exception_or_threads.get("values", []):
        if value.get("stacktrace", {}).get("frames"):
            return True

    return False


def is_handled(event_data: Mapping[str, Any]) -> bool | None:
    """
    Scans event data for the presence of one or more `handled` values.

    If no `handled` value is found, returns None.
    If a single `handled` value is found, returns the value.
    If multiple `handled` values are found, returns True iff all values are True, and False
    otherwise.
    """
    is_handled = None

    exception_values = event_data.get("exception", {}).get("values", [])
    for value in exception_values:
        handled = value.get("mechanism", {}).get("handled")

        # Even one `handled: False` value makes the entire event count as unhandled
        if handled is False:
            return False

        if handled is True:
            is_handled = True

    return is_handled


# Check if an event contains a minified stack trace (source maps for javascript)
def has_event_minified_stack_trace(event: Event) -> bool:
    exception_values = get_path(event.data, "exception", "values", filter=True)

    if exception_values:
        for exception_value in exception_values:
            if "stacktrace" in exception_value and "raw_stacktrace" in exception_value:
                return True

    return False


def is_event_from_browser_javascript_sdk(event: dict[str, Any]) -> bool:
    sdk_name = get_path(event, "sdk", "name")
    if sdk_name is None:
        return False

    return sdk_name.lower() in [
        "sentry.javascript.astro",
        "sentry.javascript.browser",
        "sentry.javascript.cloudflare",
        "sentry.javascript.react",
        "sentry.javascript.gatsby",
        "sentry.javascript.ember",
        "sentry.javascript.vue",
        "sentry.javascript.angular",
        "sentry.javascript.angular-ivy",
        "sentry.javascript.nextjs",
        "sentry.javascript.electron",
        "sentry.javascript.remix",
        "sentry.javascript.svelte",
        "sentry.javascript.sveltekit",
    ]


def track_event_since_received(
    step: str,
    event_data: MutableMapping[str, Any] | None,
    tags: dict[str, str] | None = None,
) -> None:
    """
    Helper function to track event timing metrics.
    """
    from sentry import reprocessing2

    if not event_data:
        return

    received_at = event_data.get("received")
    if not received_at:
        metrics.incr("events.missing_received", tags=tags)
        return

    platform = event_data.get("platform")

    metrics.timing(
        "events.since_received",
        time() - received_at,
        instance=platform if platform else None,
        tags={
            **(tags if tags is not None else {}),
            "step": step,
            "reprocessing": "true" if reprocessing2.is_reprocessed_event(event_data) else "false",
            "type": event_data.get("type"),
        },
    )
