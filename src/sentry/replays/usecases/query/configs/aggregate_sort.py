from snuba_sdk import Column, Function


def _activity_score():
    error_weight = Function("multiply", parameters=[Column("count_errors"), 25])
    pages_visited_weight = Function("multiply", parameters=[Column("count_urls"), 5])

    combined_weight = Function(
        "plus",
        parameters=[
            error_weight,
            pages_visited_weight,
        ],
    )

    combined_weight_normalized = Function(
        "intDivOrZero",
        parameters=[
            combined_weight,
            10,
        ],
    )

    return Function(
        "floor",
        parameters=[
            Function(
                "greatest",
                parameters=[
                    1,
                    Function(
                        "least",
                        parameters=[
                            10,
                            combined_weight_normalized,
                        ],
                    ),
                ],
            )
        ],
    )


def any_if(column_name):
    return Function(
        "anyIf", parameters=[Column(column_name), Function("notEmpty", [Column(column_name)])]
    )


sort_config = {
    "activity": _activity_score(),
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
    "started_at": Function("min", parameters=[Column("replay_start_timestamp")]),
}

sort_config["browser"] = sort_config["browser.name"]
sort_config["os"] = sort_config["os.name"]
sort_config["os_name"] = sort_config["os.name"]
