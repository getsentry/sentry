from collections.abc import Callable, Mapping, Sequence
from typing import Any, cast

from django.conf import settings

from sentry.ingest.inbound_filters.specs import (
    FilterSpec,
    browser_extensions_filter,
    healthcheck_filter,
    legacy_browsers_filter,
    localhost_filter,
    web_crawlers_filter,
)
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.relay.types import GenericFilter, GenericFiltersConfig, RuleCondition
from sentry.relay.utils import to_camel_case_name
from sentry.signals import inbound_filter_toggled

GENERIC_FILTERS_VERSION = 1


def get_filter_key(flt: FilterSpec) -> str:
    return to_camel_case_name(flt.config_name.replace("-", "_"))


def get_all_filter_specs() -> tuple[FilterSpec, ...]:
    """
    Return metadata about the filters known by Sentry.

    An event filter is a function that receives a project_config and an event data payload and returns a tuple
    (should_filter:bool, filter_reason: string | None) representing

    :return: list of registered event filters
    """
    filters = [
        localhost_filter,
        browser_extensions_filter,
        legacy_browsers_filter,
        web_crawlers_filter,
        healthcheck_filter,
    ]

    return tuple(filters)  # returning tuple for backwards compatibility


def set_filter_state(
    filter_id: str, project: Project, state: Mapping[str, Any] | None
) -> bool | list[str]:
    flt = _filter_from_filter_id(filter_id)
    if flt is None:
        raise FilterNotRegistered(filter_id)

    if flt == legacy_browsers_filter:
        if state is None:
            state = {}

        option_val: str | list[str] = "0"
        if "active" in state:
            if state["active"]:
                option_val = "1"
        elif "subfilters" in state and len(state["subfilters"]) > 0:
            option_val = sorted(set(state["subfilters"]))

        ProjectOption.objects.set_value(
            project=project, key=f"filters:{filter_id}", value=option_val
        )

        if isinstance(option_val, list):
            return option_val
        return option_val == "1"

    else:
        # all boolean filters
        if state is None:
            state = {"active": True}

        ProjectOption.objects.set_value(
            project=project,
            key=f"filters:{filter_id}",
            value="1" if state.get("active", False) else "0",
        )

        if state:
            inbound_filter_toggled.send(project=project, sender=flt)

        return state.get("active", False)


def get_filter_state(filter_id: str, project: Project) -> bool | list[str]:
    """
    Returns the filter state

    IMPORTANT: this function accesses the database, it should NEVER be used by the ingestion pipe.
    This api is used by the ProjectFilterDetails and ProjectFilters endpoints
    :param filter_id: the filter Id
    :param project: the project for which we want the filter state
    :return: True if the filter is enabled False otherwise
    :raises: ValueError if filter id not registered
    """
    flt = _filter_from_filter_id(filter_id)
    if flt is None:
        raise FilterNotRegistered(filter_id)

    filter_state = ProjectOption.objects.get_value(project=project, key=f"filters:{flt.id}")

    if filter_state is None:
        raise ValueError(
            f"Could not find filter state for filter {filter_id}."
            " You need to register default filter state in projectoptions.defaults."
        )

    if flt == legacy_browsers_filter:
        # special handling for legacy browser state
        if filter_state == "1":
            return True
        if filter_state == "0":
            return False
        return filter_state
    else:
        return filter_state == "1"


class FilterNotRegistered(Exception):
    pass


def _filter_from_filter_id(filter_id: str) -> FilterSpec | None:
    """
    Returns the corresponding filter for a filter id or None if no filter with the given id found
    """
    for flt in get_all_filter_specs():
        if flt.id == filter_id:
            return flt
    return None


def _get_filter_settings(project_config: Any, flt: FilterSpec) -> Any:
    """
    Gets the filter options from the relay config or the default option if not specified in the relay config

    :param project_config: the relay config for the request
    :param flt: the filter
    :return: the options for the filter
    """
    filter_settings = project_config.config.get("filterSettings", {})
    return filter_settings.get(get_filter_key(flt), None)


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


def get_generic_filters(
    project: Project, base_generic_filters: list[GenericFilter] | None = None
) -> GenericFiltersConfig | None:
    """
    Computes the generic inbound filters configuration for inbound filters.

    Generic inbound filters are able to express arbitrary filtering conditions on an event, using
    Relay's `RuleCondition` DSL. They differ from static inbound filters which filter events based on a
    hardcoded set of rules, specific to each type.
    """
    generic_filters: list[GenericFilter] = []
    if base_generic_filters:
        generic_filters.extend(base_generic_filters)

    for generic_filter_id, generic_filter_fn in ACTIVE_GENERIC_FILTERS:
        # This option was defaulted to string but was changed at runtime to a boolean due to an error in the
        # implementation. In order to bring it back to a string, we need to repair on read stored options. This is
        # why the value true is determined by either `1` or `True`.
        if project.get_option(f"filters:{generic_filter_id}") not in ("1", True):
            continue

        condition = generic_filter_fn()
        if condition is not None:
            generic_filters.append(
                {
                    "id": generic_filter_id,
                    "isEnabled": True,
                    "condition": condition,
                }
            )

    if not generic_filters:
        return None

    return {
        "version": GENERIC_FILTERS_VERSION,
        "filters": generic_filters,
    }


def get_log_messages_generic_filter(log_messages: list[str]) -> GenericFilter | None:
    if not log_messages:
        return None

    return {
        "id": "log-message",
        "isEnabled": True,
        "condition": {
            "op": "glob",
            "name": "log.body",
            "value": log_messages,
        },
    }


def get_trace_metric_names_generic_filter(trace_metric_names: list[str]) -> GenericFilter | None:
    if not trace_metric_names:
        return None

    return {
        "id": "trace-metric-name",
        "isEnabled": True,
        "condition": {
            "op": "glob",
            "name": "trace_metric.name",
            "value": trace_metric_names,
        },
    }
