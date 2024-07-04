from collections.abc import Callable, Sequence
from typing import TypedDict

from sentry.dynamic_sampling.rules.utils import (
    Condition,
    EqCondition,
    GlobCondition,
    GtCondition,
    GteCondition,
    LtCondition,
    LteCondition,
)
from sentry.models.project import Project


class GenericFilter(TypedDict):
    id: str
    isEnabled: bool
    condition: (
        Condition
        | EqCondition
        | GteCondition
        | GtCondition
        | LteCondition
        | LtCondition
        | GlobCondition
        | None
    )


class GenericFiltersConfig(TypedDict):
    version: int
    filters: Sequence[GenericFilter]


def _chunk_load_error_filter(project: Project) -> GenericFilter | None:
    """
    Filters out chunk load errors.

    Example:
    ChunkLoadError: Loading chunk 3662 failed.\n(error:
    https://DOMAIN.com/_next/static/chunks/29107295-0151559bd23117ba.js)
    """
    pass


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
        "*https://reactjs.org/docs/error-decoder.html?invariant={418,419,422,423,425}*",
        "*https://react.dev/errors/{418,419,422,423,425}*",
    ]

    return {
        "id": "hydration-error",
        "isEnabled": True,
        "condition": {
            "op": "or",
            "inner": [
                {"op": "glob", "name": "event.logentry.formatted", "value": values},
                {"op": "glob", "name": "event.logentry.message", "value": values},
                {
                    "op": "loop",
                    "name": "event.exceptions",
                    # Translated to `event.exceptions.index.ty`
                    "inner": {"op": "glob", "name": "ty", "value": values},
                },
            ],
        },
    }


GENERIC_FILTERS: Sequence[Callable[[Project], GenericFilter | None]] = [
    _chunk_load_error_filter,
    _hydration_error_filter,
]


def get_generic_project_filters(project: Project) -> GenericFiltersConfig:
    generic_filters = []

    for generic_filter_fn in generic_filters:
        generic_filter = generic_filter_fn(project)
        if generic_filter is not None:
            generic_filters.append(generic_filter)

    return {
        "version": 1,
        "filters": generic_filters,
    }
