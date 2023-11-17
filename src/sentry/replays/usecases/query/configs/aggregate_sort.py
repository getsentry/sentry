"""Aggregate query sorting configuration module.

Very similar to our filtering configurations except in this module we do not need the field
abstraction.  We can pass any valid Snuba expression and the query will be sorted by it.
"""
from __future__ import annotations

from datetime import datetime

from snuba_sdk import Column, Function

from sentry.replays.usecases.query.conditions.activity import aggregate_activity


def any_if(column_name):
    return Function(
        "anyIf", parameters=[Column(column_name), Function("notEmpty", [Column(column_name)])]
    )


def _click_count_sum_if_after(column_name: str) -> Function:
    return Function(
        "sumIf",
        parameters=[
            Column(column_name),
            Function(
                "greaterOrEquals",
                [Column("timestamp"), datetime(year=2023, month=7, day=24)],
            ),
        ],
    )


sort_config = {
    "activity": aggregate_activity(),
    "browser.name": any_if("browser_name"),
    "browser.version": any_if("browser_version"),
    "count_dead_clicks": _click_count_sum_if_after("click_is_dead"),
    "count_errors": Function("sum", parameters=[Column("count_error_events")]),
    "count_warnings": Function("sum", parameters=[Column("count_warning_events")]),
    "count_infos": Function("sum", parameters=[Column("count_info_events")]),
    "count_rage_clicks": _click_count_sum_if_after("click_is_rage"),
    "count_urls": Function("sum", parameters=[Column("count_urls")]),
    "device.brand": any_if("device_brand"),
    "device.family": any_if("device_family"),
    "device.model": any_if("device_model"),
    "device.name": any_if("device_name"),
    "dist": any_if("dist"),
    "duration": Function(
        "dateDiff",
        parameters=[
            "second",
            Function("min", parameters=[Column("replay_start_timestamp")]),
            Function("max", parameters=[Column("timestamp")]),
        ],
    ),
    "finished_at": Function("max", parameters=[Column("timestamp")]),
    "os.name": any_if("os_name"),
    "os.version": any_if("os_version"),
    "platform": any_if("platform"),
    "project_id": Function("any", parameters=[Column("project_id")]),
    "started_at": Function("min", parameters=[Column("replay_start_timestamp")]),
    "sdk.name": any_if("sdk_name"),
    "user.email": any_if("user_email"),
    "user.id": any_if("user_id"),
    "user.username": any_if("user_name"),
}

sort_config["browser"] = sort_config["browser.name"]
sort_config["os"] = sort_config["os.name"]
sort_config["os_name"] = sort_config["os.name"]


def sort_is_scalar_compatible(sort: str) -> bool:
    """Return "True" if the sort does not interfere with scalar search optimizations."""
    if sort.startswith("-"):
        sort = sort[1:]
    return sort in optimized_sort_fields


optimized_sort_fields: set[str] = {
    "browser.name",
    "browser.version",
    "device.brand",
    "device.family",
    "device.model",
    "device.name",
    "dist",
    "environment",
    "os.name",
    "os.version",
    "platform",
    "releases",
    "sdk.name",
    "sdk.version",
    "started_at",
    "user.email",
    "user.id",
    "user.ip_address",
    "user.username",
}
