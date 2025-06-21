from __future__ import annotations

import concurrent.futures as cf
import functools
from datetime import datetime
from typing import TypedDict

from google.cloud.exceptions import NotFound
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
)

from sentry.api.event_search import parse_search_query
from sentry.models.organization import Organization
from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    make_recording_filename,
    make_video_filename,
    storage_kv,
)
from sentry.replays.query import replay_url_parser_config
from sentry.replays.usecases.events import archive_event
from sentry.replays.usecases.query import execute_query, handle_search_filters
from sentry.replays.usecases.query.configs.scalar import scalar_search_config
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.snuba import (
    QueryExecutionError,
    QueryTooManySimultaneous,
    RateLimitExceeded,
    SnubaError,
    UnexpectedResponseError,
)

SNUBA_RETRY_EXCEPTIONS = (
    RateLimitExceeded,
    QueryTooManySimultaneous,
    SnubaError,
    QueryExecutionError,
    UnexpectedResponseError,
)


def delete_matched_rows(project_id: int, rows: list[MatchedRow]) -> int | None:
    if not rows:
        return None

    for row in rows:
        delete_replay_recordings(project_id, row)

    delete_replays(project_id, [row["replay_id"] for row in rows])
    return None


def delete_replays(project_id: int, replay_ids: list[str]) -> None:
    """Set the archived bit flag to true on each replay."""
    publisher = initialize_replays_publisher(is_async=True)
    for replay_id in replay_ids:
        publisher.publish("ingest-replay-events", archive_event(project_id, replay_id))
    publisher.flush()


def delete_replay_recordings(project_id: int, row: MatchedRow) -> None:
    with cf.ThreadPoolExecutor(max_workers=100) as pool:
        pool.map(_delete_if_exists, _make_recording_filenames(project_id, row))


def _delete_if_exists(filename: str) -> None:
    """Delete the blob if it exists or silence the 404."""
    try:
        storage_kv.delete(filename)
    except NotFound:
        pass


def _make_recording_filenames(project_id: int, row: MatchedRow) -> list[str]:
    # Null segment_ids can cause this to fail. If no segments were ingested then we can skip
    # deleting the segements.
    if row["max_segment_id"] is None:
        return []

    # We assume every segment between 0 and the max_segment_id exists. Its a waste of time to
    # delete a non-existent segment but its not so significant that we'd want to query ClickHouse
    # to verify it exists.
    replay_id = row["replay_id"]
    retention_days = row["retention_days"]
    platform = row["platform"]

    filenames = []
    for segment_id in range(row["max_segment_id"] + 1):
        segment = RecordingSegmentStorageMeta(project_id, replay_id, segment_id, retention_days)
        filenames.append(make_recording_filename(segment))
        if platform != "javascript":
            filenames.append(make_video_filename(segment))

    return filenames


class MatchedRow(TypedDict):
    retention_days: int
    replay_id: str
    max_segment_id: int | None
    platform: str


class MatchedRows(TypedDict):
    rows: list[MatchedRow]
    has_more: bool


def fetch_rows_matching_pattern(
    project_id: int,
    start: datetime,
    end: datetime,
    query: str,
    environment: list[str],
    limit: int,
    offset: int,
) -> MatchedRows:
    search_filters = parse_search_query(query, config=replay_url_parser_config)
    where = handle_search_filters(scalar_search_config, search_filters)

    if environment:
        where.append(Condition(Column("environment"), Op.IN, environment))

    query = Query(
        match=Entity("replays"),
        select=[
            Function("any", parameters=[Column("retention_days")], alias="retention_days"),
            Column("replay_id"),
            Function("max", parameters=[Column("segment_id")], alias="max_segment_id"),
            Function("any", parameters=[Column("platform")], alias="platform"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            # We only match segment rows because those contain the PII we want to delete.
            Condition(Column("segment_id"), Op.IS_NOT_NULL),
            *where,
        ],
        groupby=[Column("replay_id")],
        orderby=[OrderBy(Function("min", parameters=[Column("timestamp")]), Direction.ASC)],
        granularity=Granularity(3600),
        limit=Limit(limit),
        offset=Offset(offset),
    )

    # Queries are retried for a max for 5 attempts. Retries are exponentially delayed. This is
    # because our most likely failure is rate limit related. Blasting Snuba with more queries will
    # increase the chance of failure not reduce it.
    policy = ConditionalRetryPolicy(
        test_function=lambda a, e: a < 5 and e in SNUBA_RETRY_EXCEPTIONS,
        delay_function=exponential_delay(1.0),
    )
    response = policy(
        functools.partial(
            execute_query,
            query,
            {"tenant_id": Organization.objects.filter(project__id=project_id).get().id},
            "replays.delete_replays_bulk",
        )
    )

    rows = response.get("data", [])
    has_more = len(rows) == limit

    return {
        "has_more": has_more,
        "rows": [
            {
                "max_segment_id": row["max_segment_id"],
                "platform": row["platform"],
                "replay_id": row["replay_id"],
                "retention_days": row["retention_days"],
            }
            for row in rows
        ],
    }
