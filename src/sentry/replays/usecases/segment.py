from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from snuba_sdk import Column, Condition, Entity, Granularity, Op, Query, Request
from snuba_sdk.orderby import Direction, OrderBy

from sentry.replays.constants import REPLAY_DURATION_HOURS
from sentry.utils.snuba import raw_snql_query


def query_segment_storage_meta_by_timestamp(
    organization_id: int,
    project_id: int,
    replay_id: str,
    timestamp: float,
) -> Mapping[str, Any]:
    # Timestamps must be in UTC.
    end = datetime.fromtimestamp(timestamp + 1, tz=timezone.utc)

    # For safety look back one additional hour.
    start = end - timedelta(hours=REPLAY_DURATION_HOURS + 1)

    query = query_storage_meta()
    query = query.set_where(
        [
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("replay_id"), Op.EQ, replay_id),
            Condition(Column("segment_id"), Op.IS_NOT_NULL),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
        ]
    )

    results = raw_snql_query(
        Request(
            dataset="replays",
            app_id="replay-backend-web",
            query=query,
            tenant_ids={"organization_id": organization_id},
        ),
        referrer="replays.query.query_segment_from_timestamp",
        # There's a very low probability two users will query the same timestamp on the same
        # replay. Unless there's some accessibility url sharing behavior in the product. Until
        # then this is disabled to save us from a request to redis.
        use_cache=False,
    )

    return results


def query_storage_meta() -> Query:
    return Query(
        match=Entity("replays"),
        select=[Column("segment_id"), Column("retention_days"), Column("timestamp")],
        orderby=[OrderBy(Column("segment_id"), Direction.ASC)],
        granularity=Granularity(3600),
    )
