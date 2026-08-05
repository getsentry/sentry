from __future__ import annotations

import functools
import logging
from collections.abc import Iterator
from concurrent.futures import Future
from datetime import datetime
from typing import TypedDict

import sentry_sdk
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
from sentry.utils import metrics
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


def delete_matched_rows(project_id: int, rows: list[MatchedRow]) -> int | None:
    if not rows:
        return None

    delete_filenames_concurrently(list(_make_recording_filenames(project_id, rows)))
    delete_replays(project_id, [row["replay_id"] for row in rows])
    return None


# A batch is on the order of a thousand blobs, and a context that size is truncated to uselessness,
# so the attached filenames are capped. The counts stay exact.
_REPORTED_FILENAMES_LIMIT = 50


def _raise_for_failed_blob_deletes(futures: dict[str, Future[None]], attempted: int) -> None:
    """Raise if any blob could not be deleted, naming the ones that failed.

    A blob we failed to delete is PII we would otherwise report as deleted. Raising happens before
    the archive event is published, so a failure leaves the replay unarchived, and the finder does
    not exclude unarchived replays -- the next pass over the range picks it up again rather than
    hiding PII behind an archive marker. The task retries, so a transient failure costs a retry
    rather than the job.
    """
    errors = {
        filename: error
        for filename, error in ((name, future.exception()) for name, future in futures.items())
        if error is not None
    }
    if not errors:
        return

    metrics.incr(
        "replays.delete_recording_blobs",
        amount=len(errors),
        tags={"status": "failed"},
        sample_rate=1.0,
    )
    sentry_sdk.set_context(
        "replay_recording_blobs",
        {
            "attempted": attempted,
            "failed": len(errors),
            # Each filename is `{retention_days}/{project_id}/{replay_id}/{segment_id}`, so these
            # name the replays that still need deleting.
            "failed_filenames": sorted(errors)[:_REPORTED_FILENAMES_LIMIT],
        },
    )
    raise next(iter(errors.values()))


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
        # Keep the futures. `pool.map` returns a lazy iterator, so dropping its return value never
        # retrieved a worker exception, which is why a failed blob delete has never been visible.
        futures = {filename: pool.submit(_delete_if_exists, filename) for filename in filenames}

    _raise_for_failed_blob_deletes(futures, attempted=len(filenames))


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
            #
            # Note for anyone adding an "already archived, skip it" filter here to make re-runs
            # converge: archive rows carry `segment_id = NULL`, so this condition discards them
            # before grouping and any `HAVING max(is_archived) = 0` will therefore always be true.
            # Such a filter has to move this check into the HAVING clause (for example
            # `count(segment_id) > 0`) and widen the query window, because archive rows are stamped
            # at deletion time rather than the replay's own timestamp.
            Condition(Column("segment_id"), Op.IS_NOT_NULL),
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
