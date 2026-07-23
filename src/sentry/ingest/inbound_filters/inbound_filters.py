from collections.abc import Mapping
from typing import Any

from sentry.ingest.inbound_filters.default_filters import (
    Filter,
    browser_extensions_filter,
    healthcheck_filter,
    legacy_browsers_filter,
    localhost_filter,
    web_crawlers_filter,
)
from sentry.ingest.inbound_filters.filter_conditions import ACTIVE_GENERIC_FILTERS
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.relay.types import GenericFilter, GenericFiltersConfig
from sentry.relay.utils import to_camel_case_name
from sentry.signals import inbound_filter_toggled

GENERIC_FILTERS_VERSION = 1


class FilterNotRegistered(Exception):
    pass


def get_filter_key(filter: Filter) -> str:
    return to_camel_case_name(filter.config_name.replace("-", "_"))


ALL_FILTERS: dict[str, Filter] = {
    localhost_filter.id: localhost_filter,
    browser_extensions_filter.id: browser_extensions_filter,
    legacy_browsers_filter.id: legacy_browsers_filter,
    web_crawlers_filter.id: web_crawlers_filter,
    healthcheck_filter.id: healthcheck_filter,
}


def get_all_filter_specs() -> list[Filter]:
    return list(ALL_FILTERS.values())


def set_filter_state(
    filter_id: str, project: Project, state: Mapping[str, Any] | None
) -> bool | list[str]:
    filter = ALL_FILTERS.get(filter_id)
    if filter is None:
        raise FilterNotRegistered(filter_id)

    if filter == legacy_browsers_filter:
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
            inbound_filter_toggled.send(project=project, sender=filter)

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
    filter = ALL_FILTERS.get(filter_id)
    if filter is None:
        raise FilterNotRegistered(filter_id)

    filter_state = ProjectOption.objects.get_value(project=project, key=f"filters:{filter.id}")

    if filter_state is None:
        raise ValueError(
            f"Could not find filter state for filter {filter_id}."
            " You need to register default filter state in projectoptions.defaults."
        )

    if filter == legacy_browsers_filter and filter_state not in ("0", "1"):
        # legacy-browsers stores the list of enabled subfilters
        return filter_state
    return filter_state == "1"


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
