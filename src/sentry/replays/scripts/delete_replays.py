from __future__ import annotations

import contextlib
import logging
from collections.abc import Sequence
from datetime import datetime, timezone

from sentry.api.event_search import SearchFilter, parse_search_query
from sentry.models.organization import Organization
from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.replays.post_process import generate_normalized_output
from sentry.replays.query import query_replays_collection_paginated, replay_url_parser_config
from sentry.replays.tasks import archive_replay, delete_replay_recording_async

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
        response = query_replays_collection_paginated(
            project_ids=[project_id],
            start=start_utc,
            end=end_utc,
            fields=["id"],
            limit=batch_size,
            environment=environment,
            offset=offset,
            search_filters=search_filters,
            sort="started_at",
            organization=Organization.objects.filter(project__id=project_id).get(),
            preferred_source="scalar",
        )
        replays = list(generate_normalized_output(response.response))
        has_more = response.has_more

        # Exit early if no replays were found.
        if not replays:
            return None

        offset += len(replays)

        if dry_run:
            print(f"Replays to be deleted (dry run): {len(replays)}")  # NOQA
        else:
            delete_replay_ids(project_id, replay_ids=[r["id"] for r in replays])


def translate_cli_tags_param_to_snuba_tag_param(tags: list[str]) -> Sequence[SearchFilter]:
    return parse_search_query(" AND ".join(tags), config=replay_url_parser_config)


def delete_replay_ids(project_id: int, replay_ids: list[str]) -> None:
    """Delete a set of replay-ids for a specific project."""
    logger.info("Archiving %d replays.", len(replay_ids))

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
    # time later.
    with _bulk_produce_then_flush() as publisher:
        for replay_id in replay_ids:
            archive_replay(publisher, project_id, replay_id)

    logger.info("Scheduling %d replays for deletion.", len(replay_ids))

    # Asynchronously delete RRWeb recording data.
    #
    # Because this operation could involve millions of requests to the blob storage provider we
    # schedule the tasks to run on a cluster of workers. This allows us to parallelize the work
    # and complete the task as quickly as possible.
    for replay_id in replay_ids:
        delete_replay_recording_async.delay(project_id, replay_id)

    logger.info("%d replays were successfully deleted.", len(replay_ids))
    logger.info(
        "The customer will no longer have access to the replays passed to this function. Deletion "
        "of RRWeb data will complete asynchronously."
    )


@contextlib.contextmanager
def _bulk_produce_then_flush():
    publisher = initialize_replays_publisher(is_async=True)
    yield publisher
    publisher.flush()
