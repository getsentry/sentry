"""Scalar query filtering configuration module."""

from __future__ import annotations

from collections.abc import Sequence

from sentry.api.event_search import ParenExpression, SearchFilter
from sentry.replays.lib.new_query.conditions import NonEmptyStringScalar, StringArray, StringScalar
from sentry.replays.lib.new_query.fields import FieldProtocol, StringColumnField
from sentry.replays.lib.new_query.parsers import parse_str, parse_uuid
from sentry.replays.lib.selector.parse import parse_selector
from sentry.replays.usecases.query.conditions import (
    ClickSelectorComposite,
    DeadClickSelectorComposite,
    RageClickSelectorComposite,
)
from sentry.replays.usecases.query.fields import ComputedField


def string_field(column_name: str) -> StringColumnField:
    return StringColumnField(column_name, parse_str, StringScalar)


# Static Search Config
scalar_search_config: dict[str, FieldProtocol] = {
    "browser.name": StringColumnField("browser_name", parse_str, NonEmptyStringScalar),
    "browser.version": StringColumnField("browser_version", parse_str, NonEmptyStringScalar),
    "device.brand": StringColumnField("device_brand", parse_str, NonEmptyStringScalar),
    "device.family": StringColumnField("device_family", parse_str, NonEmptyStringScalar),
    "device.model": StringColumnField("device_model", parse_str, NonEmptyStringScalar),
    "device.name": StringColumnField("device_name", parse_str, NonEmptyStringScalar),
    "dist": StringColumnField("dist", parse_str, NonEmptyStringScalar),
    "environment": StringColumnField("environment", parse_str, NonEmptyStringScalar),
    "id": StringColumnField("replay_id", lambda x: str(parse_uuid(x)), StringScalar),
    "os.name": StringColumnField("os_name", parse_str, NonEmptyStringScalar),
    "os.version": StringColumnField("os_version", parse_str, NonEmptyStringScalar),
    "platform": StringColumnField("platform", parse_str, NonEmptyStringScalar),
    "releases": StringColumnField("release", parse_str, NonEmptyStringScalar),
    "sdk.name": StringColumnField("sdk_name", parse_str, NonEmptyStringScalar),
    "sdk.version": StringColumnField("sdk_version", parse_str, NonEmptyStringScalar),
}
# Aliases
scalar_search_config["release"] = scalar_search_config["releases"]


# Click Search Config
click_search_config: dict[str, FieldProtocol] = {
    "click.alt": string_field("click_alt"),
    "click.class": StringColumnField("click_class", parse_str, StringArray),
    "click.component_name": string_field("click_component_name"),
    "click.id": string_field("click_id"),
    "click.label": string_field("click_aria_label"),
    "click.role": string_field("click_role"),
    "click.tag": string_field("click_tag"),
    "click.testid": string_field("click_testid"),
    "click.textContent": string_field("click_text"),
    "click.title": string_field("click_title"),
    "click.selector": ComputedField(parse_selector, ClickSelectorComposite),
    "dead.selector": ComputedField(parse_selector, DeadClickSelectorComposite),
    "rage.selector": ComputedField(parse_selector, RageClickSelectorComposite),
}


def can_scalar_search_subquery(
    search_filters: Sequence[ParenExpression | SearchFilter | str],
) -> bool:
    """Return "True" if a scalar event search can be performed."""
    for search_filter in search_filters:
        # String operators have no value here. We can skip them.
        if isinstance(search_filter, str):
            continue
        # ParenExpressions are recursive.  So we recursively call our own function and return early
        # if any of the fields fail.
        elif isinstance(search_filter, ParenExpression):
            is_ok = can_scalar_search_subquery(search_filter.children)
            if not is_ok:
                return False
        else:
            name = search_filter.key.name

            # If the search-filter does not exist in the configuration then return false.
            if name not in scalar_search_config:
                return False

    # The set of filters are considered valid if the function did not return early.
    return True
