import logging
from typing import Any

import sentry_sdk

from sentry import options
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.grouping.api import GroupingConfigNotFound
from sentry.grouping.enhancer.exceptions import InvalidEnhancerConfig
from sentry.models.project import Project
from sentry.seer.similarity.utils import (
    ReferrerOptions,
    killswitch_enabled,
    project_is_seer_eligible,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.embeddings_grouping.utils import (
    NODESTORE_RETRY_EXCEPTIONS,
    GroupStacktraceData,
    create_project_cohort,
    delete_seer_grouping_records,
    filter_snuba_results,
    get_current_batch_groups_from_postgres,
    get_data_from_snuba,
    get_events_from_nodestore,
    get_next_project_from_cohort,
    send_group_and_stacktrace_to_seer,
    send_group_and_stacktrace_to_seer_multithreaded,
    update_groups,
)
from sentry.utils import metrics

SEER_ACCEPTABLE_FAILURE_REASONS = ["Gateway Timeout", "Service Unavailable"]
EVENT_INFO_EXCEPTIONS = (GroupingConfigNotFound, ResourceDoesNotExist, InvalidEnhancerConfig)

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
    last_processed_group_id: int | None = None,
    cohort: str | list[int] | None = None,
    current_project_index_in_cohort: int | None = None,
    only_delete: bool = False,
    enable_ingestion: bool = False,
    skip_processed_projects: bool = True,
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

    # This is our first time through
    if last_processed_project_id is None:
        logger.info(
            "backfill_seer_grouping_records.backfill_start",
            extra={
                "project_id": current_project_id,
                "cohort": cohort,
                "only_delete": only_delete,
                "skip_processed_projects": skip_processed_projects,
                "skip_project_ids": skip_project_ids,
                "worker_number": worker_number,
            },
        )

    if cohort is None and worker_number is not None:
        cohort = create_project_cohort(
            worker_number, skip_processed_projects, last_processed_project_id
        )
        if not cohort:
            logger.info(
                "backfill_seer_grouping_records.backfill_finished",
                extra={
                    "worker_number": worker_number,
                },
            )
            return

        logger.info(
            "backfill_seer_grouping_records.cohort_created",
            extra={
                "cohort": cohort,
                "worker_number": worker_number,
            },
        )
        current_project_id = cohort[0]
    assert current_project_id is not None

    if options.get("seer.similarity-backfill-killswitch.enabled") or killswitch_enabled(
        current_project_id, ReferrerOptions.BACKFILL
    ):
        logger.info(
            "backfill_seer_grouping_records.killswitch_enabled",
            extra={
                "project_id": current_project_id,
                "last_processed_group_id": last_processed_group_id,
                "worker_number": worker_number,
            },
        )
        return

    current_project_index_in_cohort = current_project_index_in_cohort or 0

    if last_processed_group_id is None:
        logger.info(
            "backfill_seer_grouping_records.project_start",
            extra={
                "project_id": current_project_id,
                "worker_number": worker_number,
                "project_index_in_cohort": current_project_index_in_cohort,
            },
        )

    try:
        project = Project.objects.get_from_cache(id=current_project_id)
    except Project.DoesNotExist:
        logger.info(
            "backfill_seer_grouping_records.project_does_not_exist",
            extra={"project_id": current_project_id, "worker_number": worker_number},
        )
        call_next_backfill(
            project_id=current_project_id,
            current_project_index_in_cohort=current_project_index_in_cohort,
            cohort=cohort,
            only_delete=only_delete,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
            last_processed_project_id=current_project_id,
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
                "worker_number": worker_number,
            },
        )

    if only_delete:
        delete_seer_grouping_records(current_project_id)
        logger.info(
            "backfill_seer_grouping_records.deleted_all_records",
            extra={"project_id": current_project_id},
        )

    # Only check if project is seer eligible if we are running the GA backfill
    # ie. worker number is not None
    is_project_seer_eligible = True
    if worker_number is not None:
        is_project_seer_eligible = project_is_seer_eligible(project)
        if not is_project_seer_eligible:
            logger.info(
                "backfill_seer_grouping_records.project_is_not_seer_eligible",
                extra={"project_id": project.id, "worker_number": worker_number},
            )

    if is_project_processed or is_project_skipped or only_delete or not is_project_seer_eligible:
        call_next_backfill(
            project_id=current_project_id,
            current_project_index_in_cohort=current_project_index_in_cohort,
            cohort=cohort,
            only_delete=only_delete,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
            last_processed_project_id=current_project_id,
        )
        return

    batch_size = options.get("embeddings-grouping.seer.backfill-batch-size")

    # Get the next batch of groups from postgres and filter out ineligible ones. Regardless of
    # filtering, also capture the last group id in the raw/unfiltered batch, to be used when
    # querying for the next batch. If even the unfiltered batch is emtpy, `batch_end_id` will be
    # None, which we'll pass to `call_next_backfill` so it knows to move on to the next project.
    (groups_to_backfill_with_no_embedding, batch_end_id) = get_current_batch_groups_from_postgres(
        project,
        last_processed_group_id,
        batch_size,
        worker_number,
        current_project_index_in_cohort,
        enable_ingestion,
    )

    if len(groups_to_backfill_with_no_embedding) == 0:
        call_next_backfill(
            last_processed_group_id=batch_end_id,
            project_id=current_project_id,
            current_project_index_in_cohort=current_project_index_in_cohort,
            cohort=cohort,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
            last_processed_project_id=current_project_id,
        )
        return

    snuba_results = get_data_from_snuba(
        project, groups_to_backfill_with_no_embedding, worker_number
    )

    # Filter out groups with no snuba data
    (
        filtered_snuba_results,
        groups_to_backfill_with_no_embedding_has_snuba_row,
    ) = filter_snuba_results(
        snuba_results,
        groups_to_backfill_with_no_embedding,
        project,
        worker_number,
        current_project_index_in_cohort,
    )

    if len(groups_to_backfill_with_no_embedding_has_snuba_row) == 0:
        call_next_backfill(
            last_processed_group_id=batch_end_id,
            project_id=current_project_id,
            current_project_index_in_cohort=current_project_index_in_cohort,
            cohort=cohort,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
            last_processed_project_id=current_project_id,
        )
        return

    try:
        nodestore_results, group_hashes_dict = get_events_from_nodestore(
            project,
            filtered_snuba_results,
            groups_to_backfill_with_no_embedding_has_snuba_row,
            worker_number,
            current_project_index_in_cohort,
        )
    except EVENT_INFO_EXCEPTIONS:
        metrics.incr("sentry.tasks.backfill_seer_grouping_records.grouping_config_error")
        nodestore_results = GroupStacktraceData(data=[], stacktrace_list=[])
        group_hashes_dict = {}
    except NODESTORE_RETRY_EXCEPTIONS as e:
        extra = {
            "organization_id": project.organization.id,
            "project_id": project.id,
            "error": e.message,
            "worker_number": worker_number,
        }
        logger.exception("backfill_seer_grouping_records.bulk_event_lookup_exception", extra=extra)
        group_hashes_dict = {}

    if not group_hashes_dict:
        call_next_backfill(
            last_processed_group_id=batch_end_id,
            project_id=current_project_id,
            current_project_index_in_cohort=current_project_index_in_cohort,
            cohort=cohort,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
            worker_number=worker_number,
            last_processed_project_id=current_project_id,
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
                "project_id": current_project_id,
                "project_index_in_cohort": current_project_index_in_cohort,
                "worker_number": worker_number,
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
            worker_number,
            current_project_index_in_cohort,
        )

    call_next_backfill(
        last_processed_group_id=batch_end_id,
        project_id=current_project_id,
        current_project_index_in_cohort=current_project_index_in_cohort,
        cohort=cohort,
        enable_ingestion=enable_ingestion,
        skip_processed_projects=skip_processed_projects,
        skip_project_ids=skip_project_ids,
        worker_number=worker_number,
        last_processed_project_id=current_project_id,
    )


def call_next_backfill(
    *,
    project_id: int,
    current_project_index_in_cohort: int,
    cohort: str | list[int] | None,
    enable_ingestion: bool,
    skip_processed_projects: bool,
    skip_project_ids: list[int] | None,
    worker_number: int | None,
    only_delete: bool = False,
    last_processed_group_id: int | None = None,
    last_processed_project_id: int | None = None,
) -> None:
    # When the backfill task looks for more groups in the current project and comes up empty, it
    # will pass `last_processed_group_id = None` when it calls this function. Therefore, if
    # `last_processed_group_id` has a value, we know we're not yet done with the project.
    if last_processed_group_id is not None:
        backfill_seer_grouping_records_for_project.apply_async(
            args=[
                project_id,
                last_processed_group_id,
                cohort,
                current_project_index_in_cohort,
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
        if not cohort:
            logger.info(
                "backfill_seer_grouping_records.single_project_backfill_finished",
                extra={"project_id": project_id},
            )
            return

        # call the backfill on next project
        next_project_id, next_project_index_in_cohort = get_next_project_from_cohort(
            current_project_index_in_cohort, cohort
        )

        if next_project_id is None:
            if worker_number is None:
                logger.info(
                    "backfill_seer_grouping_records.project_list_backfill_finished",
                    extra={"cohort": cohort},
                )
                # we're at the end of the project list
                return

            else:
                logger.info(
                    "backfill_seer_grouping_records.cohort_finished",
                    extra={
                        "cohort": cohort,
                        "worker_number": worker_number,
                    },
                )
                # Set `cohort` to None so the backfill task knows to create the next one
                cohort = None
                last_processed_project_id = project_id

        backfill_seer_grouping_records_for_project.apply_async(
            args=[
                next_project_id,
                None,
                cohort,
                next_project_index_in_cohort,
                only_delete,
                enable_ingestion,
                skip_processed_projects,
                skip_project_ids,
                worker_number,
                last_processed_project_id,
            ],
            headers={"sentry-propagate-traces": False},
        )
