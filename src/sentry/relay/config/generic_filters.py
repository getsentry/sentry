from collections.abc import Callable, Sequence
from typing import cast

from sentry.models.project import Project
from sentry.relay.types import GenericFilter, GenericFiltersConfig, RuleCondition

GENERIC_FILTERS_VERSION = 1


def _error_message_condition(value: Sequence[tuple[str, str]]) -> RuleCondition:
    """
    Condition that expresses error message matching for an inbound filter.
    """
    return cast(
        RuleCondition,
        {
            "op": "any",
            "name": "event.exceptions",
            "inner": {
                "op": "or",
                "inner": [
                    {
                        "op": "and",
                        "inner": [
                            {"op": "glob", "name": "ty", "value": [ty]},
                            {"op": "glob", "name": "value", "value": [value]},
                        ],
                    }
                    for ty, value in value
                ],
            },
        },
    )


def _chunk_load_error_filter(project: Project) -> GenericFilter | None:
    """
    Filters out chunk load errors.

    Example:
    ChunkLoadError: Loading chunk 3662 failed.\n(error:
    https://domain.com/_next/static/chunks/29107295-0151559bd23117ba.js)
    """
    if project.get_option("filters:chunk-load-error") not in ("1", True):
        return None

    values = [
        ("ChunkLoadError", "Loading chunk *"),
        ("*Uncaught *", "ChunkLoadError: Loading chunk *"),
    ]

    return {
        "id": "chunk-load-error",
        "isEnabled": True,
        "condition": _error_message_condition(values),
    }


def _hydration_error_filter(project: Project) -> GenericFilter | None:
    """
    Filters out hydration errors.

    Example:
    418 - Hydration failed because the initial UI does not match what was rendered on the server.
    419 - The server could not finish this Suspense boundary, likely due to an error during server rendering.
        Switched to client rendering.
    422 - There was an error while hydrating this Suspense boundary. Switched to client rendering.
    423 - There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire
        root will switch to client rendering.
    425 - Text content does not match server-rendered HTML.
    """
    if project.get_option("filters:react-hydration-errors") not in ("1", True):
        return None

    values = [
        ("*", "*https://reactjs.org/docs/error-decoder.html?invariant={418,419,422,423,425}*"),
        ("*", "*https://react.dev/errors/{418,419,422,423,425}*"),
    ]

    return {
        "id": "hydration-error",
        "isEnabled": True,
        "condition": _error_message_condition(values),
    }


# List of all active generic filters that Sentry currently sends to Relay.
ACTIVE_GENERIC_FILTERS: Sequence[Callable[[Project], GenericFilter | None]] = [
    _chunk_load_error_filter,
    _hydration_error_filter,
]


def get_generic_filters(project: Project) -> GenericFiltersConfig | None:
    """
    Computes the generic inbound filters configuration for inbound filters.

    Generic inbound filters are able to express arbitrary filtering conditions on an event, using
    Relay's `RuleCondition` DSL. They differ from static inbound filters which filter events based on a
    hardcoded set of rules, specific to each type.
    """
    generic_filters: list[GenericFilter] = []

    for generic_filter_fn in ACTIVE_GENERIC_FILTERS:
        generic_filter = generic_filter_fn(project)
        if generic_filter is not None:
            generic_filters.append(generic_filter)

    if not generic_filters:
        return None

    return {
        "version": GENERIC_FILTERS_VERSION,
        "filters": generic_filters,
    }
