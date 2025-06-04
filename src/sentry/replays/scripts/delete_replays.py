from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timezone

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Limit, Offset, Op, Query

from sentry.api.event_search import QueryToken, parse_search_query
from sentry.models.organization import Organization
from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.replays.query import replay_url_parser_config
from sentry.replays.tasks import archive_replay, delete_replays_script_async
from sentry.replays.usecases.query import execute_query, handle_search_filters
from sentry.replays.usecases.query.configs.scalar import scalar_search_config

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
    offset = 0

    start_utc = start_utc.replace(tzinfo=timezone.utc)
    end_utc = end_utc.replace(tzinfo=timezone.utc)

    has_more = True
    while has_more:
        replays, has_more = _get_rows_matching_deletion_pattern(
            project_id=project_id,
            start=start_utc,
            end=end_utc,
            limit=batch_size,
            offset=offset,
            search_filters=search_filters,
            environment=environment,
        )

        # Exit early if no replays were found.
        if not replays:
            return None

        offset += len(replays)

        if dry_run:
            print(f"Replays to be deleted (dry run): {len(replays)}")  # NOQA
        else:
            delete_replay_ids(project_id, replays)


def translate_cli_tags_param_to_snuba_tag_param(tags: list[str]) -> Sequence[QueryToken]:
    return parse_search_query(" AND ".join(tags), config=replay_url_parser_config)


def delete_replay_ids(project_id: int, rows: list[tuple[int, str, int]]) -> None:
    """Delete a set of replay-ids for a specific project."""
    logger.info("Archiving %d replays.", len(rows))

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
    publisher = initialize_replays_publisher(is_async=True)
    for _, replay_id, _ in rows:
        archive_replay(publisher, project_id, replay_id)
    publisher.flush()

    logger.info("Scheduling %d replays for deletion.", len(rows))

    # Asynchronously delete RRWeb recording data.
    #
    # Because this operation could involve millions of requests to the blob storage provider we
    # schedule the tasks to run on a cluster of workers. This allows us to parallelize the work
    # and complete the task as quickly as possible.
    for retention_days, replay_id, max_segment_id in rows:
        delete_replays_script_async.delay(retention_days, project_id, replay_id, max_segment_id)

    logger.info("%d replays were successfully deleted.", len(rows))
    logger.info(
        "The customer will no longer have access to the replays passed to this function. Deletion "
        "of RRWeb data will complete asynchronously."
    )


def _get_rows_matching_deletion_pattern(
    project_id: int,
    limit: int,
    offset: int,
    end: datetime,
    start: datetime,
    search_filters: Sequence[QueryToken],
    environment: list[str],
) -> tuple[list[tuple[int, str, int]], bool]:
    where = handle_search_filters(scalar_search_config, search_filters)

    if environment:
        where.append(Condition(Column("environment"), Op.IN, environment))

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
            *where,
        ],
        groupby=[Column("replay_id")],
        granularity=Granularity(3600),
        limit=Limit(limit),
        offset=Offset(offset),
    )

    response = execute_query(
        query,
        {"tenant_id": Organization.objects.filter(project__id=project_id).get().id},
        "replays.scripts.delete_replays",
    )

    data = response.get("data", [])
    has_more = len(data) == limit

    return (
        [
            (item["retention_days"], item["replay_id"].replace("-", ""), item["max_segment_id"])
            for item in data
        ],
        has_more,
    )
