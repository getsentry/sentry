"""Aggregate query filtering configuration module.

Every field present in the configuration is filterable.  If its not in the configuration then the
user can not filter by it.

Fields must point to the correct data source.  If they do not then the query will be wrong.

Fields must validate their input.  Failure to validate a UUID, for example, could lead to
exceptions being thrown by ClickHouse and 500 errors being returned to our customers.  Every field
must parse to the data type of its source even if its later transformed into another type.  This
acts as a validation step as must as a type coercion step.
"""

from __future__ import annotations

from sentry.replays.lib.new_query.conditions import IntegerScalar, UUIDScalar
from sentry.replays.lib.new_query.fields import (
    ColumnField,
    CountField,
    FieldProtocol,
    IntegerColumnField,
    NullableStringColumnField,
    StringColumnField,
    SumField,
    SumLengthField,
    UUIDColumnField,
)
from sentry.replays.lib.new_query.parsers import (
    parse_duration,
    parse_int,
    parse_ipv4,
    parse_str,
    parse_uuid,
)
from sentry.replays.lib.selector.parse import parse_selector
from sentry.replays.usecases.query.conditions import (
    AggregateActivityScalar,
    SimpleAggregateDurationScalar,
    SumOfClickArray,
    SumOfClickScalar,
    SumOfClickSelectorComposite,
    SumOfDeadClickSelectorComposite,
    SumOfIntegerIdScalar,
    SumOfIPv4Scalar,
    SumOfRageClickSelectorComposite,
    SumOfStringArray,
    SumOfStringScalar,
    SumOfUUIDArray,
)
from sentry.replays.usecases.query.conditions.aggregate import SumOfUUIDScalar
from sentry.replays.usecases.query.conditions.event_ids import SumOfErrorIdScalar, SumOfInfoIdScalar
from sentry.replays.usecases.query.conditions.tags import SumOfTagAggregate
from sentry.replays.usecases.query.fields import ComputedField, TagField


def click_field(column_name: str) -> StringColumnField:
    return StringColumnField(column_name, parse_str, SumOfClickScalar)


def array_click_field(column_name: str) -> StringColumnField:
    return StringColumnField(column_name, parse_str, SumOfClickArray)


def count_field(column_name: str) -> CountField:
    return CountField(column_name, parse_int, IntegerScalar)


def sum_field(column_name: str) -> SumField:
    return SumField(column_name, parse_int, IntegerScalar)


def sum_length_field(column_name: str) -> SumLengthField:
    return SumLengthField(column_name, parse_int, IntegerScalar)


def string_field(column_name: str) -> StringColumnField:
    return StringColumnField(column_name, parse_str, SumOfStringScalar)


def array_string_field(column_name: str) -> StringColumnField:
    return StringColumnField(column_name, parse_str, SumOfStringArray)


search_config: dict[str, FieldProtocol] = {
    "activity": ComputedField(parse_int, AggregateActivityScalar),
    "browser.name": string_field("browser_name"),
    "browser.version": string_field("browser_version"),
    "click.alt": click_field("click_alt"),
    "click.class": array_click_field("click_class"),
    "click.component_name": click_field("click_component_name"),
    "click.id": click_field("click_id"),
    "click.label": click_field("click_aria_label"),
    "click.role": click_field("click_role"),
    "click.selector": ComputedField(parse_selector, SumOfClickSelectorComposite),
    "click.tag": click_field("click_tag"),
    "click.testid": click_field("click_testid"),
    "click.textContent": click_field("click_text"),
    "click.title": click_field("click_title"),
    "count_dead_clicks": sum_field("click_is_dead"),
    "count_errors": sum_field("count_error_events"),
    "count_infos": sum_field("count_info_events"),
    "count_rage_clicks": sum_field("click_is_rage"),
    "count_segments": count_field("segment_id"),
    "count_urls": sum_field("count_urls"),
    "count_warnings": sum_field("count_warning_events"),
    "dead.selector": ComputedField(parse_selector, SumOfDeadClickSelectorComposite),
    "device.brand": string_field("device_brand"),
    "device.family": string_field("device_family"),
    "device.model": string_field("device_model"),
    "device.name": string_field("device_name"),
    "dist": string_field("dist"),
    "duration": ComputedField(parse_duration, SimpleAggregateDurationScalar),
    "environment": string_field("environment"),
    "error_ids": ComputedField(parse_uuid, SumOfErrorIdScalar),
    # Backwards Compat: We pass a simple string to the UUID column. Older versions of ClickHouse
    # do not understand the UUID type.
    "id": ColumnField("replay_id", parse_uuid, UUIDScalar),
    "info_ids": ComputedField(parse_uuid, SumOfInfoIdScalar),
    "os.name": string_field("os_name"),
    "os.version": string_field("os_version"),
    "platform": string_field("platform"),
    "rage.selector": ComputedField(parse_selector, SumOfRageClickSelectorComposite),
    "releases": string_field("release"),
    "replay_type": string_field("replay_type"),
    "sdk.name": string_field("sdk_name"),
    "sdk.version": string_field("sdk_version"),
    "trace_ids": UUIDColumnField("trace_ids", parse_uuid, SumOfUUIDArray),
    "urls": array_string_field("urls"),
    "user.email": string_field("user_email"),
    "user.id": string_field("user_id"),
    "user.ip_address": NullableStringColumnField("ip_address_v4", parse_ipv4, SumOfIPv4Scalar),
    "user.username": string_field("user_name"),
    "viewed_by_id": IntegerColumnField("viewed_by_id", parse_int, SumOfIntegerIdScalar),
    "warning_ids": UUIDColumnField("warning_id", parse_uuid, SumOfUUIDScalar),
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
# QQ:JFERG: why dont we have these on the scalar search
search_config["error_id"] = search_config["error_ids"]
search_config["info_id"] = search_config["info_ids"]
search_config["warning_id"] = search_config["warning_ids"]


search_config["release"] = search_config["releases"]
search_config["seen_by_id"] = search_config["viewed_by_id"]
search_config["trace_id"] = search_config["trace_ids"]
search_config["trace"] = search_config["trace_ids"]
search_config["url"] = search_config["urls"]
search_config["user.ip"] = search_config["user.ip_address"]


# Field-names which could not be found in the set are tag-keys and will, by default, look for
# the `*` key to find their search instructions. If this is not defined an error is returned.
search_config["*"] = TagField(query=SumOfTagAggregate)
