import logging
from typing import Any

import sentry_sdk
from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry import options
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.embeddings_grouping.utils import (
    FeatureError,
    delete_seer_grouping_records,
    filter_snuba_results,
    get_current_batch_groups_from_postgres,
    get_data_from_snuba,
    get_events_from_nodestore,
    get_project_for_batch,
    initialize_backfill,
    make_backfill_grouping_index_redis_key,
    make_backfill_project_index_redis_key,
    send_group_and_stacktrace_to_seer,
    send_group_and_stacktrace_to_seer_multithreaded,
    update_groups,
)
from sentry.utils import redis

BACKFILL_NAME = "backfill_grouping_records"
BULK_DELETE_METADATA_CHUNK_SIZE = 100
REDIS_KEY_EXPIRY = 60 * 60 * 24  # 1 day

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.backfill_seer_grouping_records",
    queue="backfill_seer_grouping_records",
    max_retries=5,
    silo_mode=SiloMode.REGION,
    soft_time_limit=60 * 15,
    time_limit=60 * 15 + 5,
    acks_late=True,
)
def backfill_seer_grouping_records_for_project(
    current_project_id: int,
    last_processed_group_index_input: int | None,
    cohort: str | list[int] | None = None,
    last_processed_project_index_input: int | None = None,
    only_delete=False,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Task to backfill seer grouping_records table.
    Pass in last_processed_group_index = None if calling for the first time. This function will spawn
    child tasks that will pass the last_processed_group_index
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    logger.info(
        "backfill_seer_grouping_records",
        extra={
            "current_project_id": current_project_id,
            "last_processed_group_index": last_processed_group_index_input,
            "cohort": cohort,
            "last_processed_project_index": last_processed_project_index_input,
            "only_delete": only_delete,
        },
    )

    try:
        (project, last_processed_group_index, last_processed_project_index,) = initialize_backfill(
            current_project_id,
            cohort,
            last_processed_group_index_input,
            last_processed_project_index_input,
            redis_client,
        )
    except FeatureError:
        logger.info(
            "backfill_seer_grouping_records.no_feature",
            extra={"current_project_id": current_project_id},
        )
        # TODO: let's just delete this branch since feature is on
        return
    except Project.DoesNotExist:
        logger.info(
            "backfill_seer_grouping_records.project_does_not_exist",
            extra={"current_project_id": current_project_id},
        )
        assert last_processed_project_index_input is not None
        call_next_backfill(
            last_processed_group_index=None,
            project_id=current_project_id,
            redis_client=redis_client,
            len_group_id_batch_unfiltered=0,
            last_group_id=None,
            last_processed_project_index=last_processed_project_index_input,
            cohort=cohort,
            only_delete=only_delete,
        )
        return

    if options.get("seer.similarity-backfill-killswitch.enabled"):
        logger.info("backfill_seer_grouping_records.killswitch_enabled")
        return

    if only_delete:
        delete_seer_grouping_records(current_project_id, redis_client)
        logger.info(
            "backfill_seer_grouping_records.deleted_all_records",
            extra={"current_project_id": current_project_id},
        )
        call_next_backfill(
            last_processed_group_index=None,
            project_id=current_project_id,
            redis_client=redis_client,
            len_group_id_batch_unfiltered=0,
            last_group_id=None,
            last_processed_project_index=last_processed_project_index,
            cohort=cohort,
            only_delete=only_delete,
        )
        return

    batch_size = options.get("embeddings-grouping.seer.backfill-batch-size")

    (
        groups_to_backfill_with_no_embedding,
        batch_end_index,
        total_groups_to_backfill_length,
    ) = get_current_batch_groups_from_postgres(project, last_processed_group_index, batch_size)

    if len(groups_to_backfill_with_no_embedding) == 0:
        call_next_backfill(
            last_processed_group_index=batch_end_index,
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
            last_processed_group_index=batch_end_index,
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
            last_processed_group_index=batch_end_index,
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

    if options.get("similarity.backfill_seer_threads") > 1:
        seer_response = send_group_and_stacktrace_to_seer_multithreaded(
            groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
            nodestore_results,
        )
    else:
        seer_response = send_group_and_stacktrace_to_seer(
            groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
            nodestore_results,
        )

    if not seer_response.get("success"):
        logger.info(
            "backfill_seer_grouping_records.seer_failed",
            extra={
                "current_project_id": current_project_id,
                "last_processed_project_index": last_processed_project_index,
            },
        )
        sentry_sdk.capture_exception(Exception("Seer failed during backfill"))
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
        last_processed_group_index=batch_end_index,
        project_id=current_project_id,
        redis_client=redis_client,
        len_group_id_batch_unfiltered=total_groups_to_backfill_length,
        last_group_id=last_group_id,
        last_processed_project_index=last_processed_project_index,
        cohort=cohort,
    )


def call_next_backfill(
    *,
    last_processed_group_index: int | None,
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
            f"{make_backfill_grouping_index_redis_key(project_id)}",
            last_processed_group_index if last_processed_group_index is not None else 0,
            ex=REDIS_KEY_EXPIRY,
        )
    if (
        last_processed_group_index is not None
        and last_processed_group_index < len_group_id_batch_unfiltered
    ):
        logger.info(
            "calling next backfill task",
            extra={
                "project_id": project_id,
                "last_processed_group_index": last_processed_group_index,
                "last_processed_group_id": last_group_id,
            },
        )
        backfill_seer_grouping_records_for_project.apply_async(
            args=[
                project_id,
                last_processed_group_index,
                cohort,
                last_processed_project_index,
                only_delete,
            ],
            headers={"sentry-propagate-traces": False},
        )
    else:
        # TODO: delete project redis key here if needed?
        # call the backfill on next project
        if not cohort:
            logger.info(
                "backfill finished, no cohort",
                extra={"project_id": project_id},
            )
            return

        if isinstance(cohort, str):
            cohort_projects = settings.SIMILARITY_BACKFILL_COHORT_MAP.get(cohort, [])
        else:
            cohort_projects = cohort

        batch_project_id, last_processed_project_index = get_project_for_batch(
            last_processed_project_index, cohort_projects
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

        if isinstance(cohort, str):
            redis_client.set(
                make_backfill_project_index_redis_key(str(cohort)),
                last_processed_project_index,
                ex=REDIS_KEY_EXPIRY,
            )
        backfill_seer_grouping_records_for_project.apply_async(
            args=[
                batch_project_id,
                None,
                cohort,
                last_processed_project_index,
                only_delete,
            ],
            headers={"sentry-propagate-traces": False},
        )
