from snuba_sdk import Column, Function

from sentry.replays.usecases.query.conditions.activity import aggregate_activity


def any_if(column_name):
    return Function(
        "anyIf", parameters=[Column(column_name), Function("notEmpty", [Column(column_name)])]
    )


sort_config = {
    "activity": aggregate_activity(),
    "browser.name": any_if("browser_name"),
    "count_dead_clicks": Function("sum", parameters=[Column("click_is_dead")]),
    "count_errors": Function(
        "sum", parameters=[Function("length", parameters=[Column("error_ids")])]
    ),
    "count_rage_clicks": Function("sum", parameters=[Column("click_is_rage")]),
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
    "platform": any_if("platform"),
    "project_id": Function("any", parameters=[Column("project_id")]),
    "started_at": Function("min", parameters=[Column("replay_start_timestamp")]),
}

sort_config["browser"] = sort_config["browser.name"]
sort_config["os"] = sort_config["os.name"]
sort_config["os_name"] = sort_config["os.name"]
