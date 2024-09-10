import logging
from typing import Any

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.models.project import Project
from sentry.seer.similarity.utils import killswitch_enabled, project_is_seer_eligible
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.embeddings_grouping.utils import (
    FeatureError,
    create_project_cohort,
    delete_seer_grouping_records,
    filter_snuba_results,
    get_current_batch_groups_from_postgres,
    get_data_from_snuba,
    get_events_from_nodestore,
    get_project_for_batch,
    initialize_backfill,
    send_group_and_stacktrace_to_seer,
    send_group_and_stacktrace_to_seer_multithreaded,
    update_groups,
)

BACKFILL_NAME = "backfill_grouping_records"
BULK_DELETE_METADATA_CHUNK_SIZE = 100
SEER_ACCEPTABLE_FAILURE_REASONS = ["Gateway Timeout"]

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
    current_project_id: int | None,
    last_processed_group_id_input: int | None,
    cohort: str | list[int] | None = None,
    last_processed_project_index_input: int | None = None,
    only_delete: bool = False,
    enable_ingestion: bool = False,
    skip_processed_projects: bool = False,
    skip_project_ids: list[int] | None = None,
    worker_number: int | None = None,
    last_processed_project_id: int | None = None,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Task to backfill seer grouping_records table.
    Pass in last_processed_group_id = None if calling for the first time. This function will spawn
    child tasks that will pass the last_processed_group_id
    """

    if cohort is None and worker_number is not None:
        cohort = create_project_cohort(worker_number, last_processed_project_id)
        if not cohort:
            logger.info(
                "reached the end of the projects in cohort",
                extra={
                    "worker_number": worker_number,
                },
            )
            return
        current_project_id = cohort[0]
    assert current_project_id is not None

    if options.get("seer.similarity-backfill-killswitch.enabled") or killswitch_enabled(
        current_project_id
    ):
        logger.info("backfill_seer_grouping_records.killswitch_enabled")
        return

    logger.info(
        "backfill_seer_grouping_records",
        extra={
            "current_project_id": current_project_id,
            "last_processed_group_id": last_processed_group_id_input,
            "cohort": cohort,
            "last_processed_project_index": last_processed_project_index_input,
            "only_delete": only_delete,
            "skip_processed_projects": skip_processed_projects,
            "skip_project_ids": skip_project_ids,
        },
    )

    try:
        (project, last_processed_group_id, last_processed_project_index,) = initialize_backfill(
            current_project_id,
            last_processed_group_id_input,
            last_processed_project_index_input,
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
            last_processed_group_id=None,
            project_id=current_project_id,
            last_processed_project_index=last_processed_project_index_input,
            cohort=cohort,
            only_delete=only_delete,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
        )
        return

    is_project_processed = (
        skip_processed_projects
        and project.get_option("sentry:similarity_backfill_completed") is not None
    )
    is_project_skipped = skip_project_ids and project.id in skip_project_ids
    if is_project_processed or is_project_skipped:
        logger.info(
            "backfill_seer_grouping_records.project_skipped",
            extra={
                "project_id": current_project_id,
                "project_already_processed": is_project_processed,
                "project_manually_skipped": is_project_skipped,
            },
        )

    if only_delete:
        delete_seer_grouping_records(current_project_id)
        logger.info(
            "backfill_seer_grouping_records.deleted_all_records",
            extra={"current_project_id": current_project_id},
        )

    # Only check if project is seer eligible if we are running the GA backfill
    # ie. worker number is not None
    is_project_seer_eligible = True
    if worker_number is not None:
        is_project_seer_eligible = project_is_seer_eligible(project)
        if not is_project_seer_eligible:
            logger.info(
                "backfill_seer_grouping_records.project_is_not_seer_eligible",
                extra={"project_id": project.id},
            )

    if is_project_processed or is_project_skipped or only_delete or not is_project_seer_eligible:
        call_next_backfill(
            last_processed_group_id=None,
            project_id=current_project_id,
            last_processed_project_index=last_processed_project_index,
            cohort=cohort,
            only_delete=only_delete,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
        )
        return

    batch_size = options.get("embeddings-grouping.seer.backfill-batch-size")

    (groups_to_backfill_with_no_embedding, batch_end_id) = get_current_batch_groups_from_postgres(
        project, last_processed_group_id, batch_size, enable_ingestion
    )

    if len(groups_to_backfill_with_no_embedding) == 0:
        call_next_backfill(
            last_processed_group_id=batch_end_id,
            project_id=current_project_id,
            last_processed_project_index=last_processed_project_index,
            cohort=cohort,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
        )
        return

    snuba_results = get_data_from_snuba(project, groups_to_backfill_with_no_embedding)

    (
        filtered_snuba_results,
        groups_to_backfill_with_no_embedding_has_snuba_row,
    ) = filter_snuba_results(snuba_results, groups_to_backfill_with_no_embedding, project)

    if len(groups_to_backfill_with_no_embedding_has_snuba_row) == 0:
        call_next_backfill(
            last_processed_group_id=batch_end_id,
            project_id=current_project_id,
            last_processed_project_index=last_processed_project_index,
            cohort=cohort,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
        )
        return

    nodestore_results, group_hashes_dict = get_events_from_nodestore(
        project, filtered_snuba_results, groups_to_backfill_with_no_embedding_has_snuba_row
    )
    if not group_hashes_dict:
        call_next_backfill(
            last_processed_group_id=batch_end_id,
            project_id=current_project_id,
            last_processed_project_index=last_processed_project_index,
            cohort=cohort,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
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
            project.id,
        )
    else:
        seer_response = send_group_and_stacktrace_to_seer(
            groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
            nodestore_results,
            project.id,
        )

    if not seer_response.get("success"):
        logger.info(
            "backfill_seer_grouping_records.seer_failed",
            extra={
                "reason": seer_response.get("reason"),
                "current_project_id": current_project_id,
                "last_processed_project_index": last_processed_project_index,
            },
        )
        sentry_sdk.capture_exception(Exception("Seer failed during backfill"))

        if seer_response.get("reason") not in SEER_ACCEPTABLE_FAILURE_REASONS:
            return
    else:
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
        last_processed_group_id=batch_end_id,
        project_id=current_project_id,
        last_processed_project_index=last_processed_project_index,
        cohort=cohort,
        enable_ingestion=enable_ingestion,
        skip_processed_projects=skip_processed_projects,
        skip_project_ids=skip_project_ids,
        worker_number=worker_number,
    )


def call_next_backfill(
    *,
    last_processed_group_id: int | None,
    project_id: int,
    last_processed_project_index: int,
    cohort: str | list[int] | None = None,
    only_delete: bool = False,
    enable_ingestion: bool = False,
    skip_processed_projects: bool = False,
    skip_project_ids: list[int] | None = None,
    last_processed_project_id: int | None = None,
    worker_number: int | None = None,
):
    if last_processed_group_id is not None:
        logger.info(
            "calling next backfill task",
            extra={
                "project_id": project_id,
                "last_processed_group_id": last_processed_group_id,
            },
        )
        backfill_seer_grouping_records_for_project.apply_async(
            args=[
                project_id,
                last_processed_group_id,
                cohort,
                last_processed_project_index,
                only_delete,
                enable_ingestion,
                skip_processed_projects,
                skip_project_ids,
                worker_number,
                last_processed_project_id,
            ],
            headers={"sentry-propagate-traces": False},
        )
    else:
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

        if batch_project_id is None and worker_number is None:
            logger.info(
                "reached the end of the project list",
                extra={
                    "cohort_name": cohort,
                    "last_processed_project_index": last_processed_project_index,
                },
            )
            # we're at the end of the project list
            return
        elif batch_project_id is None:
            cohort = None
            last_processed_project_id = project_id

        backfill_seer_grouping_records_for_project.apply_async(
            args=[
                batch_project_id,
                None,
                cohort,
                last_processed_project_index,
                only_delete,
                enable_ingestion,
                skip_processed_projects,
                skip_project_ids,
                worker_number,
                last_processed_project_id,
            ],
            headers={"sentry-propagate-traces": False},
        )
