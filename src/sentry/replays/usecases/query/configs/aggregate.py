from __future__ import annotations

from typing import Union

from sentry.replays.lib.new_query.conditions import NumericScalar
from sentry.replays.lib.new_query.fields import (
    CountExpressionField,
    NamedExpressionField,
    SumExpressionField,
    SumLengthExpressionField,
)
from sentry.replays.lib.new_query.parsers import parse_int, parse_str
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

from .scalar import scalar_field_name_map

# In-progress
# AggregatedIntegerField = NamedExpressionField(parse_int, NumericScalar)
# UUIDField = NamedExpressionField(parse_uuid, StringScalar)

# Done
count_field = CountExpressionField(parse_int, NumericScalar)
sum_field = SumExpressionField(parse_int, NumericScalar)
sum_length_field = SumLengthExpressionField(parse_int, NumericScalar)
error_ids_field = ComputedField(parse_str, SimpleAggregateErrorIDScalar)
selector_field = ComputedField(parse_selector, ClickSelector)
string_field = NamedExpressionField(parse_str, SumOfStringScalar)
array_string_field = NamedExpressionField(parse_str, SumOfStringComposite)
ipv4_field = NamedExpressionField(parse_str, SumOfIPv4Scalar)
tag_field = TagField(parse_str, SumOfTagScalar)


search_config: dict[str, Union[NamedExpressionField, ComputedField]] = {
    # "activity": AggregatedIntegerField,
    "browser.name": string_field,
    "browser.version": string_field,
    "click.alt": string_field,
    "click.aria_label": string_field,
    "click.class": string_field,
    "click.id": string_field,
    "click.role": string_field,
    "click.selector": selector_field,
    "click.tag": string_field,
    "click.testid": string_field,
    "click.text": string_field,
    "click.title": string_field,
    "count_dead_clicks": sum_field,
    "count_errors": sum_length_field,
    "count_rage_clicks": sum_field,
    "count_segments": count_field,
    "count_urls": sum_length_field,
    "device.brand": string_field,
    "device.family": string_field,
    "device.model": string_field,
    "device.name": string_field,
    "dist": string_field,
    # "duration": AggregatedIntegerField,
    "environment": string_field,
    "error_ids": error_ids_field,
    "os.name": string_field,
    "os.version": string_field,
    "platform": string_field,
    "releases": string_field,
    # "id": UUIDField,
    "replay_type": string_field,
    "sdk.name": string_field,
    "sdk.version": string_field,
    "trace_ids": array_string_field,
    "urls": array_string_field,
    "user.email": string_field,
    "user.id": string_field,
    "user.ip_address": ipv4_field,
    "user.username": string_field,
}


# Objects have child keys which can be explicitly searched.  To ease the search experience of
# user's we map the outer object's name to one of the inner keys.  This acts as a default search
# target if none was specified.
search_config["browser"] = search_config["browser_name"]
search_config["device"] = search_config["device_name"]
search_config["os"] = search_config["os_name"]
search_config["sdk"] = search_config["sdk_name"]
search_config["user"] = search_config["user_username"]


# Fields which have multiple names that represent the same search operation are defined here.
search_config["error_id"] = search_config["error_ids"]
search_config["release"] = search_config["releases"]
search_config["trace_id"] = search_config["trace_ids"]
search_config["trace"] = search_config["trace_ids"]
search_config["url"] = search_config["urls"]


# Field-names which could not be found in the set are tag-keys and will, by default, look for
# the `*` key to find their search instructions. If this is not defined an error is returned.
search_config["*"] = tag_field

# This isn't a true mapping of field-name to column representation.  Namely because these
# aggregated fields do not exist on the row.  This is a sort of indirect reference to its origin
# column.  This is kind of an overload of the behavior we expect.  This probably needs to be
# restructured because I can see how this will lead to confusion in the future.
#
# Possible idea: a field class which accepts column_name as an argument.  You couldn't re-use the
# singleton (like we do in other cases) but initializing a bunch of classes isn't a big deal.
aggregate_field_name_map = scalar_field_name_map.copy()
aggregate_field_name_map["count_dead_clicks"] = "click_is_dead"
aggregate_field_name_map["count_errors"] = "error_ids"
aggregate_field_name_map["count_rage_clicks"] = "click_is_rage"
aggregate_field_name_map["count_segments"] = "segment_id"
aggregate_field_name_map["count_urls"] = "urls"
