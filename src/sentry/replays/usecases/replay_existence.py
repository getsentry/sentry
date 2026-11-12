from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query, Request

from sentry.replays.query import MAX_REPLAY_LENGTH_HOURS
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def filter_existing_replay_ids(
    project_ids: Sequence[int],
    start: datetime,
    end: datetime,
    replay_ids: Sequence[str],
    tenant_ids: dict[str, Any],
) -> set[str]:
    """
    Return the subset of replays provided a sequence of replay_ids.

    ``replay_ids`` must be 32 character hex strings (dashes stripped). The returned
    set uses that same dash-less hex representation.
    """
    if not replay_ids:
        return set()

    # Padding start/end time to up the chances of seeing a segment with an error.
    padded_start = start - timedelta(hours=MAX_REPLAY_LENGTH_HOURS)
    padded_end = end + timedelta(hours=MAX_REPLAY_LENGTH_HOURS)

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                Function(
                    "replaceAll",
                    parameters=[Function("toString", parameters=[Column("replay_id")]), "-", ""],
                    alias="rid",
                ),
                Function(
                    "ifNull",
                    parameters=[Function("max", parameters=[Column("is_archived")]), 0],
                    alias="is_archived",
                ),
            ],
            where=[
                Condition(Column("project_id"), Op.IN, list(project_ids)),
                Condition(Column("timestamp"), Op.LT, padded_end),
                Condition(Column("timestamp"), Op.GTE, padded_start),
                Condition(Column("replay_id"), Op.IN, list(replay_ids)),
            ],
            having=[
                # Must include the first sequence otherwise the replay is too old.
                Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0),
                # Require non-archived replays.
                Condition(Column("is_archived"), Op.EQ, 0),
            ],
            groupby=[Column("replay_id")],
            granularity=Granularity(3600),
        ),
        tenant_ids=tenant_ids,
    )

    response = raw_snql_query(
        snuba_request,
        referrer=Referrer.API_ISSUE_DETAILS_VERIFY_RECOMMENDED_REPLAY.value,
        use_cache=True,
    )
    return {row["rid"] for row in response["data"]}
