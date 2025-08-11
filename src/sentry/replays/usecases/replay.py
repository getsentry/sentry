import collections
from datetime import datetime, timedelta, timezone
from typing import Any, TypedDict

from snuba_sdk import Column, Condition, Entity, Function, Identifier, Lambda, Op, Query
from snuba_sdk.expressions import Expression

from sentry.replays.lib.new_query.utils import translate_condition_to_function
from sentry.replays.lib.snuba import execute_query


def any_if(column_name: str, condition: Condition, alias: str | None = None) -> Function:
    """Relabel of condition_function to improve readability."""
    return conditional_function("anyIf", column_name, condition, alias)


def first_non_empty(column_name: str, alias: str | None = None):
    return Function(
        "anyIf",
        parameters=[Column(column_name), Function("notEmpty", [Column(column_name)])],
        alias=alias or column_name,
    )


def sum_fn(column_name: str, alias: str | None = None):
    return Function("sum", parameters=[Column(column_name)], alias=alias)


def conditional_function(
    function_name: str,
    column_name: str,
    condition: Condition,
    alias: str | None = None,
) -> Function:
    """Returns a conditional function.

    Helper function for translating Snuba SDK's "Condition" syntax into the required function
    syntax. This function exists because the condition syntax is easier to read and understand. It
    is not required to use this function.
    """
    return Function(
        function_name,
        parameters=[Column(column_name), translate_condition_to_function(condition)],
        alias=alias or column_name,
    )


def strip_dashes(identifier_name: str, alias: str | None = None) -> Function:
    return Function(
        "replaceAll",
        parameters=[Function("toString", parameters=[Identifier(identifier_name)]), "-", ""],
        alias=alias,
    )


def group_event_ids(column_names: list[str], alias: str | None = None) -> Function:
    return Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["error_id_no_dashes"],
                strip_dashes("error_id_no_dashes", alias=None),
            ),
            Function(
                "flatten",
                parameters=[
                    [
                        Function(
                            "arrayFilter",
                            parameters=[
                                Lambda(
                                    ["id"],
                                    Function(
                                        "notEquals",
                                        parameters=[
                                            Identifier("id"),
                                            "00000000-0000-0000-0000-000000000000",
                                        ],
                                    ),
                                ),
                                Function("groupArray", parameters=[Column(column_name)]),
                            ],
                        )
                        for column_name in column_names
                    ]
                ],
            ),
        ],
        alias=alias,
    )


def urls(alias: str | None = None):
    return Function(
        "arrayFlatten",
        parameters=[
            Function(
                "arrayMap",
                parameters=[
                    Lambda(["i"], Function("tupleElement", parameters=[Identifier("i"), 2])),
                    Function(
                        "arraySort",
                        parameters=[
                            Lambda(
                                ["i"],
                                Function(
                                    "identity",
                                    parameters=[
                                        Function("tupleElement", parameters=[Identifier("i"), 1])
                                    ],
                                ),
                            ),
                            Function(
                                "groupArray",
                                parameters=[
                                    Function(
                                        "tuple", parameters=[Column("segment_id"), Column("urls")]
                                    )
                                ],
                            ),
                        ],
                    ),
                ],
            )
        ],
        alias=alias,
    )


def activity_score():
    #  taken from frontend calculation:
    #  score = (count_errors * 25 + pagesVisited * 5 ) / 10;
    #  score = Math.floor(Math.min(10, Math.max(1, score)));

    error_weight = Function(
        "multiply", parameters=[sum_fn("count_error_events", alias="count_errors"), 25]
    )
    pages_visited_weight = Function(
        "multiply",
        parameters=[
            Function(
                "sum",
                parameters=[Function("length", parameters=[Column("urls")])],
                alias="count_urls",
            ),
            5,
        ],
    )

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
        alias="activity",
    )


QUERY_MAP: dict[str, Expression] = {
    "id": Column("replay_id"),
    "project_id": any_if(
        "project_id", Condition(Column("segment_id"), Op.EQ, 0), alias="agg_project_id"
    ),
    "started_at": Function(
        "min", parameters=[Column("replay_start_timestamp")], alias="started_at"
    ),
    "finished_at": conditional_function(
        "maxIf",
        Column("timestamp"),
        Condition(Column("segment_id"), Op.IS_NOT_NULL),
        alias="finished_at",
    ),
    "duration": Function(
        "dateDiff",
        parameters=[
            "second",
            Function("min", parameters=[Column("replay_start_timestamp")]),
            conditional_function(
                "maxIf", Column("timestamp"), Condition(Column("segment_id"), Op.IS_NOT_NULL)
            ),
        ],
        alias="duration",
    ),
    "replay_type": first_non_empty("replay_type", alias="replay_type"),
    "platform": first_non_empty("platform"),
    "environment": first_non_empty("environment", alias="agg_environment"),
    "dist": first_non_empty("dist"),
    "user.id": first_non_empty("user_id"),
    "user.email": first_non_empty("user_email"),
    "user.name": first_non_empty("user_name", alias="user_username"),
    "user.geo.city": first_non_empty("user_geo_city"),
    "user.geo.country_code": first_non_empty("user_geo_country_code"),
    "user.geo.region": first_non_empty("user_geo_region"),
    "user.geo.subdivision": first_non_empty("user_geo_subdivision"),
    "user.ip": Function(
        "IPv4NumToString",
        parameters=[any_if("ip_address_v4", Condition(Column("ip_address_v4"), Op.GT, 0))],
        alias="user_ip",
    ),
    "os.name": first_non_empty("os_name"),
    "os.version": first_non_empty("os_version"),
    "browser.name": first_non_empty("browser_name"),
    "browser.version": first_non_empty("browser_version"),
    "device.name": first_non_empty("device_name"),
    "device.brand": first_non_empty("device_brand"),
    "device.family": first_non_empty("device_family"),
    "device.model": first_non_empty("device_model"),
    "sdk.name": first_non_empty("sdk_name"),
    "sdk.version": first_non_empty("sdk_version"),
    "ota_updates.channel": first_non_empty("ota_updates_channel"),
    "ota_updates.runtime_version": first_non_empty("ota_updates_runtime_version"),
    "ota_updates.update_id": first_non_empty("ota_updates_update_id"),
    "urls": urls(alias="urls_sorted"),
    "error_ids": group_event_ids(["error_id", "fatal_id"], alias="error_ids"),
    "warning_ids": group_event_ids(["warning_id"], alias="warning_ids"),
    "info_ids": group_event_ids(["info_id", "debug_id"], alias="info_ids"),
    "trace_ids": Function(
        "arrayMap",
        parameters=[
            Lambda(["trace_id"], strip_dashes("trace_id")),
            Function("groupUniqArrayArray", parameters=[Column("trace_ids")]),
        ],
        alias="traceIds",
    ),
    "count_errors": sum_fn("count_error_events", alias="count_errors"),
    "count_warnings": sum_fn("count_warning_events", alias="count_warnings"),
    "count_infos": sum_fn("count_info_events", alias="count_infos"),
    "count_dead_clicks": sum_fn("click_is_dead", alias="count_dead_clicks"),
    "count_rage_clicks": sum_fn("click_is_rage", alias="count_rage_clicks"),
    "tags": Function(
        "groupArrayArray",
        parameters=[Function("arrayZip", parameters=[Column("tags.key"), Column("tags.value")])],
        alias="tags",
    ),
    "viewed_by_ids": Function(
        "groupUniqArrayIf",
        parameters=[
            Column("viewed_by_id"),
            Function("greater", parameters=[Column("viewed_by_id"), 0]),
        ],
        alias="viewed_by_ids",
    ),
    "count_segments": Function("count", parameters=[Column("segment_id")], alias="count_segments"),
    "count_urls": Function(
        "sum",
        parameters=[Function("length", parameters=[Column("urls")])],
        alias="count_urls",
    ),
    "is_archived": Function(
        "ifNull",
        parameters=[Function("max", parameters=[Column("is_archived")]), 0],
        alias="isArchived",
    ),
    "releases": Function(
        "groupUniqArrayIf",
        parameters=[Column("release"), Function("notEmpty", [Column("release")])],
        alias="releases",
    ),
    "activity": activity_score(),
}
"""Mapping of field name to SELECT expression."""

COMPOSITE_FIELD_MAP = {
    "browser": {"browser.name", "browser.version"},
    "device": {"device.name", "device.brand", "device.family", "device.model"},
    "os": {"os.name", "os.version"},
    "ota_updates": {"ota_updates.channel", "ota_updates.runtime_version", "ota_updates.update_id"},
    "sdk": {"sdk.name", "sdk.version"},
    "user": {
        "user.id",
        "user.email",
        "user.name",
        "user.ip",
        "user.geo.city",
        "user.geo.country_code",
        "user.geo.region",
        "user.geo.subdivision",
    },
}


class Device(TypedDict):
    brand: str
    family: str
    model: str
    name: str


class NamedAndVersioned(TypedDict):
    name: str
    version: str


class OTAUpdates(TypedDict):
    channel: str
    runtime_version: str
    update_id: str


class UserGeo(TypedDict):
    city: str
    country_code: str
    region: str
    subdivision: str


class User(TypedDict):
    display_name: str
    email: str
    id: str
    ip: str
    username: str
    geo: UserGeo


class Replay(TypedDict):
    activity: int
    browser: NamedAndVersioned
    count_dead_clicks: int
    count_errors: int
    count_infos: int
    count_rage_clicks: int
    count_segments: int
    count_urls: int
    count_warnings: int
    device: Device
    dist: str
    duration: int
    environment: str
    error_ids: list[str]
    finished_at: datetime
    has_viewed: bool
    id: str
    info_ids: list[str]
    is_archived: bool
    ota_updates: OTAUpdates
    os: NamedAndVersioned
    platform: str
    project_id: int
    releases: list[str]
    sdk: NamedAndVersioned
    started_at: datetime
    tags: dict[str, str]
    trace_ids: list[str]
    urls: list[str]
    user: User
    warning_ids: list[str]
    replay_type: str
    viewed_by_ids: list[int]


def get_replay(
    project_ids: list[int],
    replay_id: str,
    timestamp_start: datetime | None = None,
    timestamp_end: datetime | None = None,
    fields: set[str] | None = None,
    requesting_user_id: int | None = None,
    referrer: str = "replays.get_replay_unknown",
    tenant_ids: dict[str, Any] | None = None,
) -> Replay | None:
    replays = get_replays(
        project_ids=project_ids,
        replay_ids=[replay_id],
        timestamp_start=timestamp_start,
        timestamp_end=timestamp_end,
        fields=fields,
        requesting_user_id=requesting_user_id,
        referrer=referrer,
        tenant_ids=tenant_ids,
    )
    if len(replays) != 1:
        return None

    return replays[0]


def get_replays(
    project_ids: list[int],
    replay_ids: list[str],
    timestamp_start: datetime | None = None,
    timestamp_end: datetime | None = None,
    fields: set[str] | None = None,
    requesting_user_id: int | None = None,
    referrer: str = "replays.get_replays_unknown",
    tenant_ids: dict[str, Any] | None = None,
) -> list[Replay]:
    timestamp_start = timestamp_start or (datetime.now(tz=timezone.utc) - timedelta(days=90))
    timestamp_end = timestamp_end or datetime.now(tz=timezone.utc)

    # Queryset can be reduced by specifying the fields you want to be returned.
    if fields:
        flat_field_set = {field for field in fields if field not in COMPOSITE_FIELD_MAP}
        flat_field_set.add("is_archived")

        for field, value in COMPOSITE_FIELD_MAP.items():
            if field in fields:
                flat_field_set = flat_field_set.union(value)

        selected_expressions = [QUERY_MAP[field] for field in flat_field_set]
    else:
        selected_expressions = list(QUERY_MAP.values())

    # If a requesting_user_id was specified we can compute the has_viewed value.
    if requesting_user_id and (not fields or "has_viewed" in fields):
        selected_expressions.append(
            Function(
                "sum",
                parameters=[
                    Function("equals", parameters=[Column("viewed_by_id"), requesting_user_id])
                ],
                alias="has_viewed",
            )
        )

    query = Query(
        match=Entity("replays"),
        select=selected_expressions,
        where=[
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("timestamp"), Op.GTE, timestamp_start),
            Condition(Column("timestamp"), Op.LT, timestamp_end),
            Condition(Column("replay_id"), Op.IN, replay_ids),
        ],
        having=[
            Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0),
        ],
        groupby=[Column("replay_id")],
    )

    return list(map(as_replay, execute_query(query, tenant_ids=tenant_ids, referrer=referrer)))


def as_replay(data: dict[str, Any]) -> Replay:
    """Returns a Replay type from."""

    def _as_replay(data: dict[str, Any]) -> Replay:
        def get(key, default):
            # Forces a default value if any empty state was returned.
            return data.get(key, default) or default

        # Unique tag set.
        tags_set = collections.defaultdict(set)
        for v in get("tags", []):
            tags_set[v[0]].add(v[1])

        return {
            "activity": get("activity", 0),
            "browser": {
                "name": get("browser_name", ""),
                "version": get("browser_version", ""),
            },
            "count_dead_clicks": get("count_dead_clicks", 0),
            "count_errors": get("count_errors", 0),
            "count_infos": get("count_infos", 0),
            "count_rage_clicks": get("count_rage_clicks", 0),
            "count_segments": get("count_segments", 0),
            "count_urls": get("count_urls", 0),
            "count_warnings": get("count_warnings", 0),
            "device": {
                "brand": get("device_brand", ""),
                "family": get("device_family", ""),
                "model": get("device_model", ""),
                "name": get("device_name", ""),
            },
            "dist": get("dist", ""),
            "duration": get("duration", 0),
            "environment": get("agg_environment", ""),
            "error_ids": get("error_ids", []),
            "finished_at": get("finished_at", datetime.fromtimestamp(0)),
            "has_viewed": get("has_viewed", 0) > 0,
            "id": get("replay_id", "").replace("-", ""),
            "info_ids": get("info_ids", []),
            "is_archived": get("isArchived", False),
            "os": {
                "name": get("os_name", ""),
                "version": get("os_version", ""),
            },
            "ota_updates": {
                "channel": get("ota_updates_channel", ""),
                "runtime_version": get("ota_updates_runtime_version", ""),
                "update_id": get("ota_updates_update_id", ""),
            },
            "platform": get("platform", ""),
            "project_id": str(get("agg_project_id", 0)),
            "releases": get("releases", []),
            "replay_type": get("replay_type", "session"),
            "sdk": {
                "name": get("sdk_name", ""),
                "version": get("sdk_version", ""),
            },
            "started_at": get("started_at", datetime.fromtimestamp(0)),
            "tags": {k: list(v) for k, v in tags_set.items()},
            "trace_ids": get("traceIds", []),
            "urls": get("urls_sorted", []),
            "user": {
                "display_name": get(
                    "user_username", get("user_email", get("user_id", get("user_ip", "")))
                ),
                "email": get("user_email", ""),
                "id": get("user_id", ""),
                "ip": get("user_ip", ""),
                "username": get("user_username", ""),
                "geo": {
                    "city": get("user_geo_city", ""),
                    "country_code": get("user_geo_country_code", ""),
                    "region": get("user_geo_region", ""),
                    "subdivision": get("user_geo_subdivision", ""),
                },
            },
            "warning_ids": get("warning_ids", []),
            "viewed_by_ids": get("viewed_by_ids", []),
        }

    # If the data indicated the replay was archived we can ignore nearly all of the data we were
    # given and just return defaults.
    if data["isArchived"]:
        return _as_replay({"replay_id": data["replay_id"], "isArchived": True})

    return _as_replay(data)
