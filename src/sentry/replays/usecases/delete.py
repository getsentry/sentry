from __future__ import annotations

import functools
import logging
from collections.abc import Iterator
from datetime import datetime, timedelta
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
    Op,
    OrderBy,
    Query,
)
from urllib3 import Retry

from sentry.api.event_search import parse_search_query
from sentry.models.organization import Organization
from sentry.replays.lib.kafka import publish_replay_event
from sentry.replays.lib.seer_api import ReplayDeleteSeerDataRequest, make_replay_delete_request
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    make_recording_filename,
    storage_kv,
)
from sentry.replays.query import replay_url_parser_config
from sentry.replays.usecases.events import archive_event
from sentry.replays.usecases.query import execute_query, handle_search_filters
from sentry.replays.usecases.query.configs.aggregate import search_config as agg_search_config
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.snuba.referrer import Referrer
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
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

logger = logging.getLogger(__name__)


def day_aligned_windows(
    range_start: datetime, range_end: datetime
) -> list[tuple[datetime, datetime]]:
    """Split `[range_start, range_end)` into one window per UTC day it touches.

    Every window but the last runs from where the previous one ended to the next UTC midnight; the
    last closes at `range_end`. The caller's own bounds therefore survive -- the first window opens
    at `range_start`, not at midnight -- and only the first and last are ever shorter than a day.
    Consecutive windows meet exactly, so the range is covered with no gaps and no overlap. All
    datetimes are UTC.

    Never crossing midnight is what lets `datetime_as_start_of_day_conditions` assert a window's
    day. A day also holds a window's replay count well under the storage's `max_rows_to_group_by`,
    which is paired with `group_by_overflow_mode = break`: past a million replays the finders' GROUP
    BY is truncated rather than rejected, and the replays past the cut go quietly undeleted.
    """
    if range_start >= range_end:
        return []

    windows = []

    start = range_start
    while (next_midnight := _start_of_day(start) + timedelta(days=1)) < range_end:
        windows.append((start, next_midnight))
        start = next_midnight

    windows.append((start, range_end))

    return windows


def _start_of_day(value: datetime) -> datetime:
    return value.replace(hour=0, minute=0, second=0, microsecond=0)


def datetime_as_start_of_day_conditions(start: datetime, end: datetime) -> list[Condition]:
    """Restate a window that falls within one day as an equality on `toStartOfDay(timestamp)`.

    Where a table is sorted by `toStartOfDay(timestamp)` rather than by `timestamp`, a bound on the
    raw column only bounds the day it lands in, so the primary index also scans the day the window
    ends on. Naming the day directly removes that.

    Returns nothing for a window that crosses midnight, where the equality would exclude rows the
    caller asked for.
    """
    day = _start_of_day(start)
    if end > day + timedelta(days=1):
        return []

    return [Condition(Function("toStartOfDay", parameters=[Column("timestamp")]), Op.EQ, day)]


def delete_matched_rows(project_id: int, rows: list[MatchedRow]) -> int | None:
    if not rows:
        return None

    delete_filenames_concurrently(list(_make_recording_filenames(project_id, rows)))
    delete_replays(project_id, [row["replay_id"] for row in rows])
    return None


def delete_replays(project_id: int, replay_ids: list[str]) -> None:
    """Set the archived bit flag to true on each replay."""
    for replay_id in replay_ids:
        publish_replay_event(archive_event(project_id, replay_id))


#  Keeping this small bounds threads-per-task so `worker_concurrency x N` stays under pod memory limit
DELETE_THREAD_POOL_SIZE = 32


def delete_filenames_concurrently(filenames: list[str]) -> None:
    if not filenames:
        return

    # Warm the process-global client before the threads start so they reuse it instead of racing to
    # build their own.
    storage_kv.initialize_client()

    max_workers = min(len(filenames), DELETE_THREAD_POOL_SIZE)
    with ContextPropagatingThreadPoolExecutor(max_workers=max_workers) as pool:
        pool.map(_delete_if_exists, filenames)


def _delete_if_exists(filename: str) -> None:
    """Delete the blob if it exists or silence the 404."""
    try:
        storage_kv.delete(filename)
    except NotFound:
        pass


def _make_recording_filenames(project_id: int, rows: list[MatchedRow]) -> Iterator[str]:
    for row in rows:
        # Null segment_ids can cause this to fail. If no segments were ingested then we can skip
        # deleting the segements.
        if row["max_segment_id"] is None:
            continue

        # We assume every segment between 0 and the max_segment_id exists. Its a waste of time to
        # delete a non-existent segment but its not so significant that we'd want to query ClickHouse
        # to verify it exists.

        # Snuba returns `replay_id` in dashed UUID form because the column is a ClickHouse UUID, but
        # blob storage keys use the dash-stripped 32-hex form.
        replay_id = row["replay_id"].replace("-", "")
        retention_days = row["retention_days"]

        for segment_id in range(row["max_segment_id"] + 1):
            segment = RecordingSegmentStorageMeta(project_id, replay_id, segment_id, retention_days)
            yield make_recording_filename(segment)


class MatchedRow(TypedDict):
    retention_days: int
    replay_id: str
    max_segment_id: int | None


class MatchedRows(TypedDict):
    rows: list[MatchedRow]
    has_more: bool
    next_cursor: int | None


def fetch_rows_matching_pattern(
    project_id: int,
    start: datetime,
    end: datetime,
    query: str,
    environment: list[str],
    limit: int,
    after_replay_id_hash: int | None = None,
) -> MatchedRows:
    search_filters = parse_search_query(query, config=replay_url_parser_config)
    having = handle_search_filters(agg_search_config, search_filters)

    where = []
    if environment:
        where.append(Condition(Column("environment"), Op.IN, environment))

    # Fetch `cityHash64(replay_id)`. Unlike raw `replay_id` it is part of the table's
    # _sort key_, so ClickHouse can use it to skip granules while scanning.
    replay_id_hash_column = Function(
        "cityHash64", parameters=[Column("replay_id")], alias="replay_id_hash"
    )
    if after_replay_id_hash is not None:
        where.append(
            Condition(
                Function("cityHash64", parameters=[Column("replay_id")]),
                Op.GT,
                after_replay_id_hash,
            )
        )

    query = Query(
        match=Entity("replays"),
        select=[
            Function("any", parameters=[Column("retention_days")], alias="retention_days"),
            Column("replay_id"),
            Function("max", parameters=[Column("segment_id")], alias="max_segment_id"),
            replay_id_hash_column,
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            # We only match segment rows because those contain the PII we want to delete.
            Condition(Column("segment_id"), Op.IS_NOT_NULL),
            *datetime_as_start_of_day_conditions(start, end),
            *where,
        ],
        having=having,
        # Group by both the `replay_id` and `cityHash64(replay_id)` so we are able
        # to keep track of the cursor _and_ still get the Replay IDs out. Since
        # the hash is a function of the ID, this doesn't change the row contents.
        groupby=[Column("replay_id"), replay_id_hash_column],
        orderby=[OrderBy(replay_id_hash_column, Direction.ASC)],
        granularity=Granularity(3600),
        limit=Limit(limit),
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
            {"organization_id": Organization.objects.filter(project__id=project_id).get().id},
            Referrer.REPLAYS_DELETE_REPLAYS_BULK.value,
        )
    )

    rows = response.get("data", [])
    has_more = len(rows) == limit

    next_cursor = rows[-1]["replay_id_hash"] if rows else None

    return {
        "has_more": has_more,
        "next_cursor": next_cursor,
        "rows": [
            {
                "max_segment_id": row["max_segment_id"],
                "replay_id": row["replay_id"],
                "retention_days": row["retention_days"],
            }
            for row in rows
        ],
    }


def delete_seer_replay_data(organization_id: int, project_id: int, replay_ids: list[str]) -> bool:
    """
    Delete replay data from Seer.

    Returns True if the request was successful, False otherwise.
    """
    seer_request = ReplayDeleteSeerDataRequest(
        replay_ids=replay_ids,
        organization_id=organization_id,
        project_id=project_id,
    )

    viewer_context = SeerViewerContext(organization_id=organization_id)

    try:
        response = make_replay_delete_request(
            seer_request,
            timeout=5,
            retries=Retry(total=1, backoff_factor=3),  # 1 retry after a 3 second delay.
            viewer_context=viewer_context,
        )
    except Exception:
        logger.exception(
            "Failed to delete replay data from Seer",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "replay_ids": replay_ids,
            },
        )
        return False

    response_status_ok = response.status >= 200 and response.status < 300
    if not response_status_ok:
        logger.error(
            "Failed to delete replay data from Seer",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "replay_ids": replay_ids,
                "status_code": response.status,
                "response": response.data,
            },
        )
    return response_status_ok
