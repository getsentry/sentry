from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from snuba_sdk import (
    Column,
    Condition,
    Entity,
    Function,
    Granularity,
    Limit,
    Op,
    Or,
    Query,
    Request,
)
from snuba_sdk.expressions import Expression
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.event_search import QueryToken, SearchConfig
from sentry.models.organization import Organization
from sentry.replays.lib.query import all_values_for_tag_key
from sentry.replays.usecases.query import PREFERRED_SOURCE, Paginators, query_using_optimized_search
from sentry.utils.snuba import raw_snql_query

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 10
DEFAULT_OFFSET = 0


# Compatibility function for getsentry code.
def query_replays_collection(*args, **kwargs):
    return query_replays_collection_paginated(*args, **kwargs).response


def query_replays_collection_paginated(
    project_ids: list[int],
    start: datetime,
    end: datetime,
    environment: list[str],
    fields: list[str],
    sort: str | None,
    limit: int,
    offset: int,
    search_filters: Sequence[QueryToken],
    preferred_source: PREFERRED_SOURCE,
    organization: Organization | None = None,
    actor: Any | None = None,
):
    """Query aggregated replay collection."""
    paginators = Paginators(limit, offset)

    return query_using_optimized_search(
        fields=fields,
        search_filters=search_filters,
        environments=environment,
        sort=sort,
        pagination=paginators,
        organization=organization,
        project_ids=project_ids,
        period_start=start,
        period_stop=end,
        request_user_id=actor.id if actor else None,
        preferred_source=preferred_source,
    )


def query_replays_count(
    project_ids: list[int],
    start: datetime,
    end: datetime,
    replay_ids: list[str],
    tenant_ids: dict[str, Any],
):
    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                # The expression is explicitly aliased as "rid" to prevent the default
                # alias "replay_id" from shadowing the replay_id column. When the column
                # is shadowed our index is disabled in the WHERE and we waste a lot of
                # compute parsing UUIDs we don't care about.
                _strip_uuid_dashes("replay_id", Column("replay_id"), alias="rid"),
                Function(
                    "ifNull",
                    parameters=[
                        Function(
                            "max",
                            parameters=[Column("is_archived")],
                        ),
                        0,
                    ],
                    alias="is_archived",
                ),
            ],
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("replay_id"), Op.IN, replay_ids),
            ],
            having=[
                # Must include the first sequence otherwise the replay is too old.
                Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0),
                # Require non-archived replays.
                Condition(Column("is_archived"), Op.EQ, 0),
            ],
            orderby=[],
            groupby=[Column("replay_id")],
            granularity=Granularity(3600),
        ),
        tenant_ids=tenant_ids,
    )
    return raw_snql_query(
        snuba_request, referrer="replays.query.query_replays_count", use_cache=True
    )


def query_replays_dataset_tagkey_values(
    project_ids: list[int],
    start: datetime,
    end: datetime,
    environment: str | None,
    tag_key: str,
    tag_substr_query: str | None,
    tenant_ids: dict[str, Any] | None,
):
    """
    Query replay tagkey values. Like our other tag functionality, aggregates do not work here.
    This function is used by the tagstore backend, which expects a `tag_value` key in each result object.

    @param tag_substr_query: used to filter tag values with a case-insensitive substring.
    """

    where = []
    if environment:
        where.append(Condition(Column("environment"), Op.IN, environment))

    grouped_column = TAG_QUERY_ALIAS_COLUMN_MAP.get(tag_key)
    if grouped_column is None:
        # see https://clickhouse.com/docs/en/sql-reference/functions/array-join/
        # for arrayJoin behavior. we use it to return a flattened
        # row for each value in the tags.value array
        aggregated_column = Function(
            "arrayJoin",
            parameters=[all_values_for_tag_key(tag_key, Column("tags.key"), Column("tags.value"))],
            alias="tag_value",
        )
        grouped_column = Column("tag_value")

    else:
        # using identity to alias the column
        aggregated_column = Function("identity", parameters=[grouped_column], alias="tag_value")

    if tag_substr_query:
        where.append(
            Condition(
                Function(
                    "positionCaseInsensitive",
                    parameters=[grouped_column, tag_substr_query],
                ),
                Op.NEQ,
                0,
            )
        )

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                Function("uniq", parameters=[Column("replay_id")], alias="times_seen"),
                Function("min", parameters=[Column("timestamp")], alias="first_seen"),
                Function("max", parameters=[Column("timestamp")], alias="last_seen"),
                aggregated_column,
            ],
            where=[
                *where,
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("timestamp"), Op.GTE, start),
                Or(
                    [
                        Condition(Column("is_archived"), Op.EQ, 0),
                        Condition(Column("is_archived"), Op.IS_NULL),
                    ]
                ),
            ],
            orderby=[OrderBy(Column("times_seen"), Direction.DESC)],
            groupby=[grouped_column],
            granularity=Granularity(3600),
            limit=Limit(1000),
        ),
        tenant_ids=tenant_ids,
    )
    return raw_snql_query(
        snuba_request,
        referrer="replays.query.query_replays_dataset_tagkey_values",
        use_cache=True,
    )


# Filter

replay_url_parser_config = SearchConfig(
    numeric_keys={
        "count_errors",
        "count_segments",
        "count_urls",
        "count_dead_clicks",
        "count_rage_clicks",
        "activity",
        "count_warnings",
        "count_infos",
        "count_traces",
        "count_screens",
    },
    duration_keys={"duration"},
    boolean_keys={"is_archived"},
)


# Pagination.


def make_pagination_values(limit: Any, offset: Any) -> Paginators:
    """Return a tuple of limit, offset values."""
    limit = _coerce_to_integer_default(limit, DEFAULT_PAGE_SIZE)
    if limit > MAX_PAGE_SIZE or limit < 0:
        limit = DEFAULT_PAGE_SIZE

    offset = _coerce_to_integer_default(offset, DEFAULT_OFFSET)
    return Paginators(limit, offset)


def _coerce_to_integer_default(value: str | None, default: int) -> int:
    """Return an integer or default."""
    if value is None:
        return default

    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _strip_uuid_dashes(
    input_name: str,
    input_value: Expression,
    alias: str | None = None,
    aliased: bool = True,
):
    return Function(
        "replaceAll",
        parameters=[Function("toString", parameters=[input_value]), "-", ""],
        alias=alias or input_name if aliased else None,
    )


TAG_QUERY_ALIAS_COLUMN_MAP = {
    "replay_type": Column("replay_type"),
    "platform": Column("platform"),
    "environment": Column("environment"),
    "release": Column("release"),
    "dist": Column("dist"),
    "url": Function("arrayJoin", parameters=[Column("urls")]),
    "user.id": Column("user_id"),
    "user.username": Column("user_name"),
    "user.email": Column("user_email"),
    "user.ip": Function(
        "IPv4NumToString",
        parameters=[Column("ip_address_v4")],
    ),
    "sdk.name": Column("sdk_name"),
    "sdk.version": Column("sdk_version"),
    "os.name": Column("os_name"),
    "os.version": Column("os_version"),
    "browser.name": Column("browser_name"),
    "browser.version": Column("browser_version"),
    "device.name": Column("device_name"),
    "device.brand": Column("device_brand"),
    "device.family": Column("device_family"),
    "device.model_id": Column("device_model"),
}
