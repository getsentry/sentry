from collections.abc import Sequence

from snuba_sdk import Column, Function
from snuba_sdk.expressions import Expression

from sentry.api.event_search import ParenExpression, SearchFilter
from sentry.replays.lib.new_query.conditions import (
    IntegerScalar,
    IPv4Scalar,
    StringScalar,
    UUIDScalar,
)
from sentry.replays.lib.new_query.fields import ExpressionField, FieldProtocol
from sentry.replays.lib.new_query.parsers import parse_int, parse_ipv4, parse_str, parse_uuid

#
# Expression definition.
#
# Shared expression definitions for interacting with the materialized view. These
# expressions may be exposed to the user through any of the configurations found in
# this file.
#


def activity_expression(count_errors, count_urls):
    error_weight = Function("multiply", parameters=[count_errors, 25])
    pages_visited_weight = Function("multiply", parameters=[count_urls, 5])
    combined_weight = Function("plus", parameters=[error_weight, pages_visited_weight])
    combined_weight_normalized = Function("intDivOrZero", parameters=[combined_weight, 10])

    return Function(
        "floor",
        parameters=[
            Function(
                "greatest",
                parameters=[1, Function("least", parameters=[10, combined_weight_normalized])],
            )
        ],
        alias="activity",
    )


expressions: dict[str, Expression] = {
    "browser_name": Function("anyIfMerge", parameters=[Column("browser_name")]),
    "browser_version": Function("anyIfMerge", parameters=[Column("browser_version")]),
    "count_dead_clicks": Function("sumMerge", parameters=[Column("count_dead_clicks")]),
    "count_errors": Function("sumMerge", parameters=[Column("count_errors")]),
    "count_rage_clicks": Function("sumMerge", parameters=[Column("count_rage_clicks")]),
    "count_segments": Function("countMerge", parameters=[Column("count_segments")]),
    "count_urls": Function("sumMerge", parameters=[Column("count_urls")]),
    "device_brand": Function("anyIfMerge", parameters=[Column("device_brand")]),
    "device_family": Function("anyIfMerge", parameters=[Column("device_family")]),
    "device_model": Function("anyIfMerge", parameters=[Column("device_model")]),
    "device_name": Function("anyIfMerge", parameters=[Column("device_name")]),
    "dist": Function("anyIfMerge", parameters=[Column("dist")]),
    "duration": Function("anyIfMerge", parameters=[Column("duration")]),
    "finished_at": Function("maxIfMerge", parameters=[Column("finished_at")]),
    "environment": Function("anyIfMerge", parameters=[Column("environment")]),
    "id": Column("replay_id"),
    "ip_address_v4": Function("anyMerge", parameters=[Column("ip_address_v4")]),
    "ip_address_v6": Function("anyMerge", parameters=[Column("ip_address_v6")]),
    "os_name": Function("anyIfMerge", parameters=[Column("os_name")]),
    "os_version": Function("anyIfMerge", parameters=[Column("os_version")]),
    "platform": Function("anyIfMerge", parameters=[Column("platform")]),
    "sdk_name": Function("anyIfMerge", parameters=[Column("sdk_name")]),
    "sdk_version": Function("anyIfMerge", parameters=[Column("sdk_version")]),
    "started_at": Function("minMerge", parameters=[Column("started_at")]),
    "user": Function("anyIfMerge", parameters=[Column("user")]),
    "user_id": Function("anyIfMerge", parameters=[Column("user_id")]),
    "user_name": Function("anyIfMerge", parameters=[Column("user_name")]),
    "user_email": Function("anyIfMerge", parameters=[Column("user_email")]),
}

expressions["activity"] = activity_expression(
    expressions["count_errors"], expressions["count_urls"]
)
expressions["duration"] = Function(
    "dateDiff", parameters=["second", expressions["started_at"], expressions["finished_at"]]
)

#
# Search configuration.
#
# Defines a mapping of exposed fields and their filtering ruleset. The filtering ruleset
# will accept a search request and transform it to a filter expression.
#

search_config: dict[str, FieldProtocol] = {
    "activity": ExpressionField(expressions["activity"], parse_int, IntegerScalar),
    "browser.name": ExpressionField(expressions["browser_name"], parse_str, StringScalar),
    "browser.version": ExpressionField(expressions["browser_version"], parse_str, StringScalar),
    "count_dead_clicks": ExpressionField(
        expressions["count_dead_clicks"], parse_int, IntegerScalar
    ),
    "count_errors": ExpressionField(expressions["count_errors"], parse_int, IntegerScalar),
    "count_rage_clicks": ExpressionField(
        expressions["count_rage_clicks"], parse_int, IntegerScalar
    ),
    "count_segments": ExpressionField(expressions["count_segments"], parse_int, IntegerScalar),
    "count_urls": ExpressionField(expressions["count_urls"], parse_int, IntegerScalar),
    "device.brand": ExpressionField(expressions["device_brand"], parse_str, StringScalar),
    "device.family": ExpressionField(expressions["device_family"], parse_str, StringScalar),
    "device.model": ExpressionField(expressions["device_model"], parse_str, StringScalar),
    "device.name": ExpressionField(expressions["device_name"], parse_str, StringScalar),
    "dist": ExpressionField(expressions["dist"], parse_str, StringScalar),
    "duration": ExpressionField(expressions["duration"], parse_int, IntegerScalar),
    "environment": ExpressionField(expressions["environment"], parse_str, StringScalar),
    "id": ExpressionField(expressions["id"], parse_uuid, UUIDScalar),
    "os.name": ExpressionField(expressions["os_name"], parse_str, StringScalar),
    "os.version": ExpressionField(expressions["os_version"], parse_str, StringScalar),
    "platform": ExpressionField(expressions["platform"], parse_str, StringScalar),
    "sdk.name": ExpressionField(expressions["sdk_name"], parse_str, StringScalar),
    "sdk.version": ExpressionField(expressions["sdk_version"], parse_str, StringScalar),
    "user": ExpressionField(expressions["user"], parse_str, StringScalar),
    "user.id": ExpressionField(expressions["user_id"], parse_str, StringScalar),
    "user.ip_address": ExpressionField(expressions["ip_address_v4"], parse_ipv4, IPv4Scalar),
    "user.username": ExpressionField(expressions["user_name"], parse_str, StringScalar),
    "user.email": ExpressionField(expressions["user_email"], parse_str, StringScalar),
}

# Common aliases.
search_config["browser"] = search_config["browser.name"]
search_config["device"] = search_config["device.name"]
search_config["os"] = search_config["os.name"]
search_config["sdk"] = search_config["sdk.name"]
search_config["user"] = search_config["user.username"]
search_config["user.ip"] = search_config["user.ip_address"]


def can_search(search_filters: Sequence[ParenExpression | SearchFilter | str]) -> bool:
    """Return true if the search is materialized-view eligible."""
    for search_filter in search_filters:
        if isinstance(search_filter, str):
            continue
        elif isinstance(search_filter, ParenExpression):
            is_ok = can_search(search_filter.children)
            if not is_ok:
                return False
        else:
            name = search_filter.key.name
            if name not in search_config:
                return False

    # If every search condition is contained within the configuration set we can
    # use the materialized view.
    return True


#
# Sort configuration.
#
# Defines a mapping of exposed fields and their sort expressions. This mapping defines what
# is allowed by the user to sort and how. Sorts are actually applied in an external
# operation.
#

sort_config: dict[str, Expression] = {
    "activity": expressions["activity"],
    "browser.name": expressions["browser_name"],
    "browser.version": expressions["browser_version"],
    "count_dead_clicks": expressions["count_dead_clicks"],
    "count_errors": expressions["count_errors"],
    "count_rage_clicks": expressions["count_rage_clicks"],
    "count_segments": expressions["count_segments"],
    "count_urls": expressions["count_urls"],
    "device.brand": expressions["device_brand"],
    "device.family": expressions["device_family"],
    "device.model": expressions["device_model"],
    "device.name": expressions["device_name"],
    "dist": expressions["dist"],
    "duration": expressions["duration"],
    "environment": expressions["environment"],
    "id": expressions["id"],
    "os.name": expressions["os_name"],
    "os.version": expressions["os_version"],
    "platform": expressions["platform"],
    "sdk.name": expressions["sdk_name"],
    "sdk.version": expressions["sdk_version"],
    "started_at": expressions["started_at"],
    "user": expressions["user"],
    "user.id": expressions["user_id"],
    "user.ip_address": expressions["ip_address_v4"],
    "user.username": expressions["user_name"],
    "user.email": expressions["user_email"],
}

# Common aliases.
sort_config["browser"] = sort_config["browser.name"]
sort_config["device"] = sort_config["device.name"]
sort_config["os"] = sort_config["os.name"]
sort_config["sdk"] = sort_config["sdk.name"]
sort_config["user"] = sort_config["user.username"]
sort_config["user.ip"] = sort_config["user.ip_address"]


def can_sort(sort: str) -> bool:
    """Return true if the sort is materialized-view eligible."""
    if sort.startswith("-"):
        sort = sort[1:]
    return sort in sort_config


#
# Select configuration.
#

select_config: dict[str, list[Expression]] = {
    "activity": [expressions["activity"]],
    "browser": [expressions["browser_name"], expressions["browser_version"]],
    "count_dead_clicks": [expressions["count_dead_clicks"]],
    "count_errors": [expressions["count_errors"]],
    "count_rage_clicks": [expressions["count_rage_clicks"]],
    "device": [
        expressions["device_brand"],
        expressions["device_family"],
        expressions["device_model"],
        expressions["device_name"],
    ],
    "dist": [expressions["dist"]],
    "duration": [expressions["duration"]],
    "environment": [expressions["environment"]],
    "id": [expressions["id"]],
    "os": [expressions["os_name"], expressions["os_version"]],
    "platform": [expressions["platform"]],
    "sdk": [expressions["sdk_name"], expressions["sdk_version"]],
    "started_at": [expressions["started_at"]],
    "user": [
        expressions["user"],
        expressions["user_id"],
        expressions["ip_address_v4"],
        expressions["user_name"],
        expressions["user_email"],
    ],
}

# If no fields were given a subset is returned by default.
DEFAULT_SELECTION = [
    "activity",
    "browser",
    "count_dead_clicks",
    "count_errors",
    "count_rage_clicks",
    "duration",
    "id",
    "os",
    "platform",
    "started_at",
    "user",
]


def can_select(fields: list[str]) -> bool:
    """Return true if the selection set is materialized-view eligible."""
    for field in fields:
        if field not in select_config:
            return False
    return True


def make_selection(fields: list[str]) -> list[Expression]:
    """Return a selection set from a list of fields."""
    expressions = []
    for field in fields or DEFAULT_SELECTION:
        expressions += select_config[field]
    return expressions
