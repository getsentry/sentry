"""Scalar query filtering configuration module."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

from sentry.api.event_search import ParenExpression, SearchFilter
from sentry.replays.lib.new_query.conditions import (
    NonEmptyStringScalar,
    StringArray,
    StringScalar,
    UUIDArray,
)
from sentry.replays.lib.new_query.fields import FieldProtocol, StringColumnField, UUIDColumnField
from sentry.replays.lib.new_query.parsers import parse_str, parse_uuid
from sentry.replays.lib.selector.parse import parse_selector
from sentry.replays.usecases.query.conditions import (
    ClickSelectorComposite,
    DeadClickSelectorComposite,
    RageClickSelectorComposite,
)
from sentry.replays.usecases.query.conditions.event_ids import ErrorIdScalar
from sentry.replays.usecases.query.conditions.tags import TagScalar
from sentry.replays.usecases.query.configs.aggregate import search_config as aggregate_search_config
from sentry.replays.usecases.query.fields import ComputedField, TagField


def string_field(column_name: str) -> StringColumnField:
    return StringColumnField(column_name, parse_str, StringScalar)


# Static Search Config
static_search_config: dict[str, FieldProtocol] = {
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
static_search_config["release"] = static_search_config["releases"]


# Varying Search Config
#
# Fields in this configuration file can vary.  This makes it difficult to draw conclusions when
# multiple conditions are strung together.  By isolating these values into a separate config we
# are codifying a rule which should be enforced elsewhere in code: "only one condition from this
# config allowed".
varying_search_config: dict[str, FieldProtocol] = {
    "error_ids": ComputedField(parse_uuid, ErrorIdScalar),
    "trace_ids": UUIDColumnField("trace_ids", parse_uuid, UUIDArray),
    "urls": StringColumnField("urls", parse_str, StringArray),
}

# Aliases
varying_search_config["error_id"] = varying_search_config["error_ids"]
varying_search_config["trace_id"] = varying_search_config["trace_ids"]
varying_search_config["trace"] = varying_search_config["trace_ids"]
varying_search_config["url"] = varying_search_config["urls"]
varying_search_config["*"] = TagField(query=TagScalar)


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


# Clicks are omitted from the scalar search config because they do not share the same row like
# the other configs do.
scalar_search_config = {**static_search_config, **varying_search_config}


def can_scalar_search_subquery(
    search_filters: Sequence[ParenExpression | SearchFilter | str],
    started_at: datetime,
) -> bool:
    """Return "True" if a scalar event search can be performed."""
    has_seen_varying_field = False

    for search_filter in search_filters:
        # String operators have no value here. We can skip them.
        if isinstance(search_filter, str):
            continue
        # ParenExpressions are recursive.  So we recursively call our own function and return early
        # if any of the fields fail.
        elif isinstance(search_filter, ParenExpression):
            is_ok = can_scalar_search_subquery(search_filter.children, started_at)
            if not is_ok:
                return False
        else:
            name = search_filter.key.name

            # If the search-filter does not exist in either configuration then return false.
            if name not in static_search_config and name not in varying_search_config:
                # If the field is not a tag or the query's start period is greater than the
                # period when the new field was introduced then we can not apply the
                # optimization.
                #
                # TODO(cmanallen): Remove date condition after 90 days (~12/17/2024).
                if name in aggregate_search_config or started_at < datetime(
                    2024, 9, 17, tzinfo=timezone.utc
                ):
                    return False
                else:
                    has_seen_varying_field = True
                    continue

            if name in varying_search_config:
                # If a varying field has been seen before then we can't use a row-based sub-query. We
                # need to use an aggregation query to ensure the two values are found or not found
                # within the context of the aggregate replay.
                if has_seen_varying_field:
                    return False

                # Negated conditionals require knowledge of the aggregate state to determine if the
                # value truly does not exist in the aggregate replay result.
                if search_filter.operator in ("!=", "NOT IN"):
                    return False

                has_seen_varying_field = True

    # The set of filters are considered valid if the function did not return early.
    return True
