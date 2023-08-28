"""Aggregate query sorting configuration module.

Very similar to our filtering configurations except in this module we do not need the field
abstraction.  We can pass any valid Snuba expression and the query will be sorted by it.
"""
from snuba_sdk import Column, Function

from sentry.replays.usecases.query.conditions.activity import aggregate_activity


def any_if(column_name):
    return Function(
        "anyIf", parameters=[Column(column_name), Function("notEmpty", [Column(column_name)])]
    )


sort_config = {
    "activity": aggregate_activity(),
    "browser.name": any_if("browser_name"),
    "browser.version": any_if("browser_version"),
    "count_dead_clicks": Function("sum", parameters=[Column("click_is_dead")]),
    "count_errors": Function("sum", parameters=[Column("count_errors")]),
    "count_rage_clicks": Function("sum", parameters=[Column("click_is_rage")]),
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
