from __future__ import annotations

from typing import Union

from sentry.replays.lib.new_query.conditions import NumericScalar, UUIDScalar
from sentry.replays.lib.new_query.fields import (
    ColumnField,
    CountExpressionField,
    StringColumnField,
    SumExpressionField,
    SumLengthExpressionField,
)
from sentry.replays.lib.new_query.parsers import parse_int, parse_str, parse_uuid
from sentry.replays.lib.selector.parse import parse_selector
from sentry.replays.usecases.query.conditions.aggregate import (
    SumOfIPv4Scalar,
    SumOfStringComposite,
    SumOfStringScalar,
    SumOfTagScalar,
)
from sentry.replays.usecases.query.conditions.error_ids import SimpleAggregateErrorIDScalar
from sentry.replays.usecases.query.conditions.selector import ClickSelector
from sentry.replays.usecases.query.fields import ComputedField, TagField

# In-progress
# AggregatedIntegerField = NamedExpressionField(parse_int, NumericScalar)


def count_field(column_name: str) -> CountExpressionField:
    return CountExpressionField(column_name, parse_int, NumericScalar)


def sum_field(column_name: str) -> SumExpressionField:
    return SumExpressionField(column_name, parse_int, NumericScalar)


def sum_length_field(column_name: str) -> SumLengthExpressionField:
    return SumLengthExpressionField(column_name, parse_int, NumericScalar)


def string_field(column_name: str) -> StringColumnField:
    return StringColumnField(column_name, parse_str, SumOfStringScalar)


def array_string_field(column_name: str) -> StringColumnField:
    return StringColumnField(column_name, parse_str, SumOfStringComposite)


search_config: dict[str, Union[ColumnField, ComputedField]] = {
    # "activity": AggregatedIntegerField,
    "browser.name": string_field("browser_name"),
    "browser.version": string_field("browser_version"),
    "click.alt": string_field("click_alt"),
    "click.aria_label": string_field("click_aria_label"),
    "click.class": string_field("click_class"),
    "click.id": string_field("click_id"),
    "click.role": string_field("click_role"),
    "click.selector": ComputedField(parse_selector, ClickSelector),
    "click.tag": string_field("click_tag"),
    "click.testid": string_field("click_testid"),
    "click.text": string_field("click_text"),
    "click.title": string_field("click_title"),
    "count_dead_clicks": sum_field("click_is_dead"),
    "count_errors": sum_length_field("error_ids"),
    "count_rage_clicks": sum_field("click_is_rage"),
    "count_segments": count_field("segment_id"),
    "count_urls": sum_length_field("urls"),
    "device.brand": string_field("device_brand"),
    "device.family": string_field("device_family"),
    "device.model": string_field("device_model"),
    "device.name": string_field("device_name"),
    "dist": string_field("dist"),
    # "duration": AggregatedIntegerField,
    "environment": string_field("environment"),
    "error_ids": ComputedField(parse_str, SimpleAggregateErrorIDScalar),
    "os.name": string_field("os_name"),
    "os.version": string_field("os_version"),
    "platform": string_field("platform"),
    "releases": string_field("release"),
    "id": ColumnField("replay_id", parse_uuid, UUIDScalar),
    "replay_type": string_field("replay_type"),
    "sdk.name": string_field("sdk_name"),
    "sdk.version": string_field("sdk_version"),
    "trace_ids": array_string_field("trace_ids"),
    "urls": array_string_field("urls"),
    "user.email": string_field("user_email"),
    "user.id": string_field("user_id"),
    "user.ip_address": StringColumnField("ip_address_v4", parse_str, SumOfIPv4Scalar),
    "user.username": string_field("user_username"),
}


# Objects have child keys which can be explicitly searched.  To ease the search experience of
# user's we map the outer object's name to one of the inner keys.  This acts as a default search
# target if none was specified.
search_config["browser"] = search_config["browser.name"]
search_config["device"] = search_config["device.name"]
search_config["os"] = search_config["os.name"]
search_config["sdk"] = search_config["sdk.name"]
search_config["user"] = search_config["user.username"]


# Fields which have multiple names that represent the same search operation are defined here.
search_config["error_id"] = search_config["error_ids"]
search_config["release"] = search_config["releases"]
search_config["trace_id"] = search_config["trace_ids"]
search_config["trace"] = search_config["trace_ids"]
search_config["url"] = search_config["urls"]


# Field-names which could not be found in the set are tag-keys and will, by default, look for
# the `*` key to find their search instructions. If this is not defined an error is returned.
search_config["*"] = TagField(parse_str, SumOfTagScalar)
