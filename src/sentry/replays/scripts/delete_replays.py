from __future__ import annotations

import functools
import logging
import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

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

from sentry import features, options
from sentry.api.event_search import QueryToken, parse_search_query
from sentry.models.organization import Organization
from sentry.replays.query import replay_url_parser_config
from sentry.replays.tasks import archive_replay, delete_replays_script_async
from sentry.replays.usecases.delete import SNUBA_RETRY_EXCEPTIONS, delete_seer_replay_data
from sentry.replays.usecases.query import execute_query, handle_search_filters
from sentry.replays.usecases.query.configs.scalar import scalar_search_config
from sentry.snuba.referrer import Referrer
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay

logger = logging.getLogger()


def delete_replays(
    project_id: int,
    dry_run: bool,
    batch_size: int,
    environment: list[str],
    tags: list[str],
    start_utc: datetime,
    end_utc: datetime,
) -> None:
    """Delete a set of replays from a query."""
    search_filters = translate_cli_tags_param_to_snuba_tag_param(tags)

    start_utc = start_utc.replace(tzinfo=timezone.utc)
    end_utc = end_utc.replace(tzinfo=timezone.utc)

    organization = Organization.objects.filter(project__id=project_id).get()
    has_seer_data = features.has("organizations:replay-ai-summaries", organization)

    # Running tally of replays to be deleted, accumulated across windows and pages
    total_replays = 0

    # Chunk the range into fixed-size windows
    chunk_size_days = options.get("replay.bulk_delete_job.chunk_size_days") or 7

    window_offset_days = 0
    while True:
        window_start = start_utc + timedelta(days=window_offset_days)
        if window_start >= end_utc:
            break
        window_end = min(window_start + timedelta(days=chunk_size_days), end_utc)

        # Reset per window because the cursor space is scoped to the window's result set
        last_replay_id = None

        has_more = True
        while has_more:
            replays, has_more, last_replay_id = _get_rows_matching_deletion_pattern(
                project_id=project_id,
                organization_id=organization.id,
                start=window_start,
                end=window_end,
                limit=batch_size,
                after_replay_id=last_replay_id,
                search_filters=search_filters,
                environment=environment,
            )

            # Pages can filter to nothing, so use `has_more` to determine termination rather than single empty
            if replays:
                total_replays += len(replays)

                logging_context = {
                    "project_id": project_id,
                    "dry_run": dry_run,
                    "batch_size": batch_size,
                    "tags": tags,
                    "window_start": window_start,
                    "window_end": window_end,
                    "has_more": has_more,
                    "total_replays": total_replays,
                }
                if dry_run:
                    logger.info(
                        f"Replays to be deleted (dry run): {len(replays)}", extra=logging_context
                    )
                else:
                    delete_replay_ids(
                        project_id,
                        organization_id=organization.id,
                        rows=replays,
                        has_seer_data=has_seer_data,
                        total_replays=total_replays,
                    )

        window_offset_days += chunk_size_days


def translate_cli_tags_param_to_snuba_tag_param(tags: list[str]) -> Sequence[QueryToken]:
    return parse_search_query(" AND ".join(tags), config=replay_url_parser_config)


def delete_replay_ids(
    project_id: int,
    organization_id: int,
    rows: list[tuple[int, str, int]],
    has_seer_data: bool,
    total_replays: int,
) -> None:
    """Delete a set of replay-ids for a specific project."""
    logging_context = {
        "project_id": project_id,
        "num_replays": len(rows),
        "total_replays": total_replays,
    }
    logger.info("Archiving %d replays.", len(rows), extra=logging_context)

    # Bulk produce archived replay rows to the ingest-replay-events topic before flushing.
    #
    # This operation is fast enough that it can be performed synchronously. Archiving
    # synchronously gives the script runner the feeling that the script executed to completion
    # and will allow them to immediately spot-check before moving on with their day. In a
    # purely asynchronous world the script runner will have to continually worry if their tasks
    # executed.
    #
    # This also gives us reasonable assurances that if the script ran to completion the customer
    # will not be able to access their deleted data even if the actual deletion takes place some
    # time later
    for _, replay_id, _ in rows:
        archive_replay(project_id, replay_id)

    if has_seer_data:
        # The finder strips dashes from `replay_id`; Seer keys on the dashed UUID
        replay_ids = [str(uuid.UUID(replay_id)) for _, replay_id, _ in rows]
        delete_seer_replay_data(organization_id, project_id, replay_ids)

    logger.info("Scheduling %d replays for deletion.", len(rows), extra=logging_context)

    # Asynchronously delete RRWeb recording data.
    #
    # Because this operation could involve millions of requests to the blob storage provider we
    # schedule the tasks to run on a cluster of workers. This allows us to parallelize the work
    # and complete the task as quickly as possible.
    for retention_days, replay_id, max_segment_id in rows:
        delete_replays_script_async.delay(retention_days, project_id, replay_id, max_segment_id)

    logger.info("%d replays were successfully deleted.", len(rows), extra=logging_context)
    logger.info(
        "The customer will no longer have access to the replays passed to this function. Deletion "
        "of RRWeb data will complete asynchronously.",
        extra=logging_context,
    )


def _get_rows_matching_deletion_pattern(
    project_id: int,
    organization_id: int,
    limit: int,
    after_replay_id: str | None,
    end: datetime,
    start: datetime,
    search_filters: Sequence[QueryToken],
    environment: list[str],
) -> tuple[list[tuple[int, str, int]], bool, str | None]:
    where = handle_search_filters(scalar_search_config, search_filters)

    if environment:
        where.append(Condition(Column("environment"), Op.IN, environment))

    # Keyset cursor in order to walk result set in fixed-cost pages. Need the ORDER BY to keep it deterministic
    if after_replay_id is not None:
        where.append(Condition(Column("replay_id"), Op.GT, after_replay_id))

    query = Query(
        match=Entity("replays"),
        select=[
            Function("any", parameters=[Column("retention_days")], alias="retention_days"),
            Column("replay_id"),
            Function("max", parameters=[Column("segment_id")], alias="max_segment_id"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("segment_id"), Op.IS_NOT_NULL),
            *where,
        ],
        groupby=[Column("replay_id")],
        orderby=[OrderBy(Column("replay_id"), Direction.ASC)],
        granularity=Granularity(3600),
        limit=Limit(limit),
    )

    policy = ConditionalRetryPolicy(
        test_function=lambda a, e: a < 5 and isinstance(e, SNUBA_RETRY_EXCEPTIONS),
        delay_function=exponential_delay(1.0),
    )
    response = policy(
        functools.partial(
            execute_query,
            query,
            {"organization_id": organization_id},
            Referrer.REPLAYS_SCRIPTS_DELETE_REPLAYS.value,
        )
    )

    data = response.get("data", [])
    has_more = len(data) == limit

    # The next page seeks past the last raw replay_id in this page
    next_cursor = data[-1]["replay_id"] if data else None

    return (
        [
            (item["retention_days"], item["replay_id"].replace("-", ""), item["max_segment_id"])
            for item in data
            if item["max_segment_id"] is not None
        ],
        has_more,
        next_cursor,
    )
