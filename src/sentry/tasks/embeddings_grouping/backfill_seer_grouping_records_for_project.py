import logging
from typing import Any

from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry import options
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.embeddings_grouping.utils import (
    FeatureError,
    delete_seer_grouping_records,
    filter_snuba_results,
    get_current_batch_groups_from_postgres,
    get_data_from_snuba,
    get_events_from_nodestore,
    initialize_backfill,
    make_backfill_redis_key,
    send_group_and_stacktrace_to_seer,
    update_groups,
)

BACKFILL_NAME = "backfill_grouping_records"
BULK_DELETE_METADATA_CHUNK_SIZE = 100
SNUBA_QUERY_RATELIMIT = 4

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.backfill_seer_grouping_records",
    queue="default",
    max_retries=0,
    silo_mode=SiloMode.REGION,
    soft_time_limit=60 * 15,
    time_limit=60 * 15 + 5,
)
def backfill_seer_grouping_records_for_project(
    current_project_id: int,
    last_processed_group_index: int | None,
    cohort: str | list[int] | None = None,
    last_processed_project_index: int = 0,
    only_delete=False,
    *args: Any,
    **kwargs: Any,
) -> None:
    logger.info(
        "backfill_seer_grouping_records",
        extra={
            "current_project_id": current_project_id,
            "last_processed_group_index": last_processed_group_index,
            "cohort": cohort,
            "last_processed_project_index": last_processed_project_index,
            "only_delete": only_delete,
        },
    )
    """
    Task to backfill seer grouping_records table.
    Pass in last_processed_index = None if calling for the first time. This function will spawn
    child tasks that will pass the last_processed_index
    """

    try:
        project, redis_client, last_processed_group_index = initialize_backfill(
            current_project_id, last_processed_group_index
        )
    except FeatureError:
        logger.info(
            "backfill_seer_grouping_records.no_feature",
            extra={"current_project_id": current_project_id},
        )
        # TODO:
        # call_next_backfill(
        #     last_processed_index=None,
        #     project_id=current_project_id,
        #     redis_client=redis_client,
        #     len_group_id_batch_unfiltered=None,
        #     last_group_id=None,
        #     last_processed_project_index=last_processed_project_index,
        #     cohort=cohort,
        # )
        return

    if only_delete:
        delete_seer_grouping_records(project.id, redis_client)
        logger.info(
            "backfill_seer_grouping_records.deleted_all_records",
            extra={"current_project_id": project.id},
        )
        # call_next_backfill(
        #     last_processed_index=None,
        #     project_id=current_project_id,
        #     redis_client=redis_client,
        #     len_group_id_batch_unfiltered=0,
        #     last_group_id=None,
        #     last_processed_project_index=last_processed_project_index,
        #     cohort=cohort,
        # )
        return

    batch_size = options.get("embeddings-grouping.seer.backfill-batch-size")

    (
        groups_to_backfill_with_no_embedding,
        batch_end_index,
        total_groups_to_backfill_length,
    ) = get_current_batch_groups_from_postgres(project, last_processed_group_index, batch_size)

    if len(groups_to_backfill_with_no_embedding) == 0:
        call_next_backfill(
            last_processed_index=batch_end_index,
            project_id=current_project_id,
            redis_client=redis_client,
            len_group_id_batch_unfiltered=total_groups_to_backfill_length,
            last_group_id=None,
            last_processed_project_index=last_processed_project_index,
            cohort=cohort,
        )
        return

    last_group_id = groups_to_backfill_with_no_embedding[-1]

    snuba_results = get_data_from_snuba(project, groups_to_backfill_with_no_embedding)

    (
        filtered_snuba_results,
        groups_to_backfill_with_no_embedding_has_snuba_row,
    ) = filter_snuba_results(snuba_results, groups_to_backfill_with_no_embedding, project)

    if len(groups_to_backfill_with_no_embedding_has_snuba_row) == 0:
        call_next_backfill(
            last_processed_index=batch_end_index,
            project_id=current_project_id,
            redis_client=redis_client,
            len_group_id_batch_unfiltered=total_groups_to_backfill_length,
            last_group_id=last_group_id,
            last_processed_project_index=last_processed_project_index,
            cohort=cohort,
        )
        return

    nodestore_results, group_hashes_dict = get_events_from_nodestore(
        project, filtered_snuba_results, groups_to_backfill_with_no_embedding_has_snuba_row
    )
    if not group_hashes_dict:
        call_next_backfill(
            last_processed_index=batch_end_index,
            project_id=current_project_id,
            redis_client=redis_client,
            len_group_id_batch_unfiltered=total_groups_to_backfill_length,
            last_group_id=last_group_id,
            last_processed_project_index=last_processed_project_index,
            cohort=cohort,
        )
        return

    groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row = [
        group_id
        for group_id in groups_to_backfill_with_no_embedding_has_snuba_row
        if group_id in group_hashes_dict
    ]

    seer_response = send_group_and_stacktrace_to_seer(
        project,
        groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
        nodestore_results,
    )
    if not seer_response.get("success"):
        logger.info(
            "backfill_seer_grouping_records.seer_down",
            extra={
                "current_project_id": project.id,
                "last_processed_project_index": last_processed_project_index,
            },
        )
        return

    update_groups(
        project,
        seer_response,
        groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
        group_hashes_dict,
    )

    logger.info(
        "about to call next backfill",
        extra={
            "project_id": current_project_id,
        },
    )
    call_next_backfill(
        last_processed_index=batch_end_index,
        project_id=current_project_id,
        redis_client=redis_client,
        len_group_id_batch_unfiltered=total_groups_to_backfill_length,
        last_group_id=last_group_id,
        last_processed_project_index=last_processed_project_index,
        cohort=cohort,
    )


def call_next_backfill(
    *,
    last_processed_index: int,
    project_id: int,
    redis_client: RedisCluster | StrictRedis,
    len_group_id_batch_unfiltered: int,
    last_group_id: int | None,
    last_processed_project_index: int,
    cohort: str | list[int] | None = None,
    only_delete: bool = False,
):

    if last_group_id is not None:
        redis_client.set(
            f"{make_backfill_redis_key(project_id)}",
            last_processed_index if last_processed_index is not None else 0,
            ex=60 * 60 * 24 * 7,
        )
    if last_processed_index and last_processed_index < len_group_id_batch_unfiltered:

        logger.info(
            "calling next backfill task",
            extra={
                "project_id": project_id,
                "last_processed_index": last_processed_index,
                "last_processed_group_id": last_group_id,
            },
        )
        backfill_seer_grouping_records_for_project.apply_async(
            args=[
                project_id,
                last_processed_index,
                cohort,
                last_processed_project_index,
                only_delete,
            ],
        )
    else:
        # call the backfill on next project
        if not cohort:
            return

        if isinstance(cohort, str):
            cohort_list = settings.SIMILARITY_BACKFILL_COHORT_MAP.get(cohort, [])
        else:
            cohort_list = cohort

        batch_project_id, last_processed_project_index = get_project_for_batch(
            last_processed_project_index, cohort_list, cohort
        )

        if batch_project_id is None:
            logger.info(
                "reached the end of the project list",
                extra={
                    "cohort_name": cohort,
                    "last_processed_project_index": last_processed_project_index,
                },
            )
            # we're at the end of the project list
            return
        # TODO: redis
        backfill_seer_grouping_records_for_project.apply_async(
            args=[
                batch_project_id,
                None,
                cohort,
                last_processed_project_index,
                only_delete,
            ],
        )


def get_project_for_batch(last_processed_project_index, cohort_list, cohort_name):
    next_cohort_index = last_processed_project_index + 1
    if next_cohort_index >= len(cohort_list):
        return None, None
    project_id = cohort_list[next_cohort_index]
    last_processed_project_index = next_cohort_index
    return project_id, last_processed_project_index
