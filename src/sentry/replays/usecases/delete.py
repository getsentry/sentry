from __future__ import annotations

import functools
import logging
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
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
    parse_snuba_datetime,
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
    """Restate `[start, end)` as bounds on `toStartOfDay(timestamp)`.

    A table sorted by `toStartOfDay(timestamp)` keeps its rows grouped by day, and its index knows
    only which day each block of rows belongs to. Conditions written in those same terms line up
    with how the rows are ordered, so whole days can be skipped without being read at all. That is
    what makes filtering by day cheap on such a table, and why it is worth asking for the day
    directly.

    A condition on the raw `timestamp` has to be translated into days first, and the translation is
    deliberately careful at the top end: it includes the day the upper bound falls in, because a
    bound at, say, noon really does leave matching rows in that day. A bound at midnight leaves
    none, but the day gets read regardless. Naming the last day the range actually reaches drops
    it -- one day of blocks at any range width, which on a table with the real sort key took a
    one-day range from 25 blocks to 13.

    The bottom end translates exactly, so the `>=` neither costs nor saves anything measurable. It
    is here so the pair reads as the span of days it is.

    `end` is exclusive, so a range ending exactly at midnight does not reach that day.
    """
    day = Function("toStartOfDay", parameters=[Column("timestamp")])

    return [
        Condition(day, Op.GTE, _start_of_day(start)),
        Condition(day, Op.LTE, _start_of_day(end - timedelta(microseconds=1))),
    ]


def delete_matched_rows(project_id: int, rows: list[MatchedRow]) -> int | None:
    if not rows:
        return None

    delete_filenames_concurrently(list(_make_recording_filenames(project_id, rows)))
    delete_replays(project_id, rows)
    return None


def delete_replays(project_id: int, rows: list[MatchedRow]) -> None:
    """Set the archived bit flag to true on each replay.

    Each archive event is stamped with the replay's own timestamp rather than "now" so it lands in
    the same date range the replay does and hides it there.
    """
    for row in rows:
        publish_replay_event(archive_event(project_id, row["replay_id"], row["timestamp"]))


#  Keeping this small bounds threads-per-task so `worker_concurrency x N` stays under pod memory limit
DELETE_THREAD_POOL_SIZE = 32


class BlobDeleteFailed(Exception):
    """A recording blob could not be deleted."""


def delete_filenames_concurrently(filenames: list[str]) -> None:
    if not filenames:
        return

    # Warm the process-global client before the threads start so they reuse it instead of racing to
    # build their own.
    storage_kv.initialize_client()

    max_workers = min(len(filenames), DELETE_THREAD_POOL_SIZE)
    with ContextPropagatingThreadPoolExecutor(max_workers=max_workers) as pool:
        # Keep the futures. `pool.map` returns a lazy iterator, so dropping its return value never
        # retrieved a worker exception, which is why a failed blob delete has never been visible.
        futures = [pool.submit(_delete_if_exists, filename) for filename in filenames]

    failed = sum(1 for future in futures if future.exception() is not None)
    if failed:
        raise BlobDeleteFailed(f"{failed} of {len(filenames)} recording blobs were not deleted")


_BLOB_DELETE_ATTEMPTS = 2
_BLOB_DELETE_RETRY = ConditionalRetryPolicy(
    test_function=lambda attempt, error: attempt < _BLOB_DELETE_ATTEMPTS
    and not isinstance(error, NotFound),
    delay_function=exponential_delay(0.5),
)


def _delete_if_exists(filename: str) -> None:
    """Delete the blob if it exists or silence the 404."""
    try:
        _BLOB_DELETE_RETRY(lambda: storage_kv.delete(filename))
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
    # Replay ID with dashes
    replay_id: str
    max_segment_id: int | None
    # The Replay's last segment within the queried window
    timestamp: datetime


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
            Function("max", parameters=[Column("timestamp")], alias="finished_at"),
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
        test_function=lambda a, e: a < 5 and isinstance(e, SNUBA_RETRY_EXCEPTIONS),
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
                "timestamp": snuba_timestamp_as_utc(row["finished_at"]),
            }
            for row in rows
        ],
    }


def snuba_timestamp_as_utc(value: str) -> datetime:
    """Parse a timestamp Snuba returned, as UTC.

    Snuba renders datetimes with a zone sometimes and without one others. They are UTC either way,
    and an unzoned one has to be told so before anything reads it as an instant -- `.timestamp()`
    treats a naive datetime as local time, which would shift it by the host's offset.
    """
    parsed = parse_snuba_datetime(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


SEER_DELETE_RETRY = Retry(
    total=1,
    backoff_factor=1,
    allowed_methods=None,  # Allow retry on POST, since deletion is idempotent
    status_forcelist=[429, 500, 502, 503, 504],
)

SEER_DELETE_TIMEOUT = 30


class SeerDeleteFailed(Exception):
    """Seer refused to delete a set of replay summaries."""


def delete_seer_replay_data(organization_id: int, project_id: int, replay_ids: list[str]) -> None:
    """Delete these replays' summaries from Seer, raising if it will not.

    A summary is derived from the replay's contents, so one left behind is PII left behind. Failures
    propagate rather than being reported, so a caller cannot accidentally treat a refused deletion as
    a completed one. The replay ids are already on the caller's Sentry scope.
    """
    response = make_replay_delete_request(
        ReplayDeleteSeerDataRequest(
            replay_ids=replay_ids,
            organization_id=organization_id,
            project_id=project_id,
        ),
        timeout=SEER_DELETE_TIMEOUT,
        retries=SEER_DELETE_RETRY,
        viewer_context=SeerViewerContext(organization_id=organization_id),
    )

    if not 200 <= response.status < 300:
        raise SeerDeleteFailed(f"Seer returned {response.status} for {len(replay_ids)} replays")
