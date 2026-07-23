from collections.abc import Callable, Sequence
from typing import cast

from django.conf import settings

from sentry.relay.types import RuleCondition


def _error_message_condition(
    values: Sequence[tuple[str | None, str | None]],
    match_logentry: bool = False,
) -> RuleCondition:
    """
    Condition that expresses error message matching for an inbound filter.

    When ``match_logentry`` is set, type-less patterns (``(None, message)``) also match
    the event's ``logentry.formatted`` message, so events captured via ``capture_message``
    (which carry no exception interface) are covered in addition to exceptions.
    """
    conditions = []
    message_conditions: list[RuleCondition] = []

    for ty, value in values:
        ty_and_value: list[RuleCondition] = []

        if ty is not None:
            ty_and_value.append({"op": "glob", "name": "ty", "value": [ty]})
        if value is not None:
            ty_and_value.append({"op": "glob", "name": "value", "value": [value]})

        if len(ty_and_value) == 1:
            conditions.append(ty_and_value[0])
        elif len(ty_and_value) == 2:
            conditions.append(
                {
                    "op": "and",
                    "inner": ty_and_value,
                }
            )

        # A logentry message has no exception type, so only type-less patterns can match
        # it. Glob the formatted message string directly.
        if match_logentry and ty is None and value is not None:
            message_conditions.append(
                {"op": "glob", "name": "event.logentry.formatted", "value": [value]}
            )

    exception_condition = cast(
        RuleCondition,
        {
            "op": "any",
            "name": "event.exception.values",
            "inner": {
                "op": "or",
                "inner": conditions,
            },
        },
    )

    if not message_conditions:
        return exception_condition

    return cast(
        RuleCondition,
        {
            "op": "or",
            "inner": [exception_condition, *message_conditions],
        },
    )


def _chunk_load_error_filter() -> RuleCondition:
    """
    Filters out chunk load errors.

    Example:
    ChunkLoadError: Loading chunk 3662 failed.\n(error:
    https://domain.com/_next/static/chunks/29107295-0151559bd23117ba.js)
    """
    values = [
        # Webpack
        ("ChunkLoadError", "Loading chunk *"),
        ("*Uncaught *", "ChunkLoadError: Loading chunk *"),
        # Turbopack
        ("ChunkLoadError", "Failed to load chunk *"),
        ("*Uncaught *", "ChunkLoadError: Failed to load chunk *"),
        # Promise rejections
        ("Error", "Uncaught (in promise): ChunkLoadError*"),
    ]

    return _error_message_condition(values)


def _custom_error_filter() -> RuleCondition | None:
    values = settings.SENTRY_INBOUND_FILTER_CUSTOM_VALUES
    # The filter is enabled by default for all projects, but is a no-op unless custom
    # values are configured. Return None so it is omitted from the Relay config entirely.
    if not values:
        return None
    return _error_message_condition(values, match_logentry=True)


def _hydration_error_filter() -> RuleCondition:
    """
    Filters out hydration errors.

    Example:
    418 - Hydration failed because the initial UI does not match what was rendered on the server.
    419 - The server could not finish this Suspense boundary, likely due to an error during server rendering.
        Switched to client rendering.
    421 - This Suspense boundary received an update before it finished hydrating. This caused the boundary to switch to client rendering.
        The usual way to fix this is to wrap the original update in startTransition.
    422 - There was an error while hydrating this Suspense boundary. Switched to client rendering.
    423 - There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire
        root will switch to client rendering.
    425 - Text content does not match server-rendered HTML.
    """
    values = [
        (None, "*https://reactjs.org/docs/error-decoder.html?invariant={418,419,421,422,423,425}*"),
        (None, "*https://react.dev/errors/{418,419,421,422,423,425}*"),
    ]

    return _error_message_condition(values)


# List of all active generic filters that Sentry currently sends to Relay.
ACTIVE_GENERIC_FILTERS: Sequence[tuple[str, Callable[[], RuleCondition | None]]] = [
    ("chunk-load-error", _chunk_load_error_filter),
    ("react-hydration-errors", _hydration_error_filter),
    ("custom-error", _custom_error_filter),
]
