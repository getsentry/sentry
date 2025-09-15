import logging
from collections.abc import Sequence
from typing import Any

from sentry import options
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.seer.similarity.grouping_records import (
    call_seer_to_delete_project_grouping_records,
    call_seer_to_delete_these_hashes,
)
from sentry.seer.similarity.utils import ReferrerOptions, killswitch_enabled
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.delete_seer_grouping_records_by_hash",
    queue="delete_seer_grouping_records_by_hash",
    max_retries=0,  # XXX: Why do we not retry?
    silo_mode=SiloMode.REGION,
    soft_time_limit=60 * 15,
    time_limit=60 * (15 + 5),
    taskworker_config=TaskworkerConfig(
        namespace=seer_tasks,
        processing_deadline_duration=60 * (15 + 5),
    ),
)
def delete_seer_grouping_records_by_hash(
    project_id: int,
    hashes: Sequence[str],
    last_deleted_index: int = 0,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Task to delete seer grouping records by hash list.
    Calls the seer delete by hash endpoint with batches of hashes of size `batch_size`.
    """
    if killswitch_enabled(project_id, ReferrerOptions.DELETION) or options.get(
        "seer.similarity-embeddings-delete-by-hash-killswitch.enabled"
    ):
        return

    batch_size = options.get("embeddings-grouping.seer.delete-record-batch-size")
    len_hashes = len(hashes)
    if len_hashes <= batch_size:  # Base case
        call_seer_to_delete_these_hashes(project_id, hashes)
    else:
        if last_deleted_index != 0:
            # This tracks which tasks are still being scheduled with the whole list of hashes
            metrics.incr(
                "grouping.similarity.delete_seer_grouping_records_by_hash.batch_size_exceeded",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            )

        # Iterate through hashes in chunks and schedule a task for each chunk
        # There are tasks passing last_deleted_index, thus, we need to start from that index
        # Eventually all tasks will pass 0
        for i in range(last_deleted_index, len_hashes, batch_size):
            # Slice operations are safe and will not raise IndexError
            chunked_hashes = hashes[i : i + batch_size]
            delete_seer_grouping_records_by_hash.apply_async(args=[project_id, chunked_hashes, 0])


def may_schedule_task_to_delete_hashes_from_seer(group_ids: Sequence[int]) -> None:
    if not group_ids:
        return

    if killswitch_enabled(None, ReferrerOptions.DELETION) or options.get(
        "seer.similarity-embeddings-delete-by-hash-killswitch.enabled"
    ):
        return

    # Single optimized query for project lookup
    try:
        group = Group.objects.select_related("project").get(id=group_ids[0])
    except Group.DoesNotExist:
        logger.warning("Group not found for deletion", extra={"group_id": group_ids[0]})
        return

    project = group.project

    if not (
        project
        and project.get_option("sentry:similarity_backfill_completed")
        and not killswitch_enabled(project.id, ReferrerOptions.DELETION)
    ):
        return

    batch_size = options.get("embeddings-grouping.seer.delete-record-batch-size")

    group_hashes = get_hashes_for_group_ids(group_ids, project)
    if not group_hashes:
        return

    # Schedule tasks in chunks
    for i in range(0, len(group_hashes), batch_size):
        chunk = group_hashes[i : i + batch_size]
        delete_seer_grouping_records_by_hash.apply_async(args=[project.id, chunk, 0])


def get_hashes_for_group_ids(group_ids: Sequence[int], project: Project) -> list[str]:
    hashes_batch_size = options.get("deletions.group-hashes-fetch-batch-size")
    group_hashes = []

    for group_id in group_ids:
        for group_hash in RangeQuerySetWrapper(
            GroupHash.objects.filter(project_id=project.id, group__id=group_id),
            step=hashes_batch_size,
        ):
            group_hashes.append(group_hash.hash)

    return group_hashes


@instrumented_task(
    name="sentry.tasks.call_seer_delete_project_grouping_records",
    queue="delete_seer_grouping_records_by_hash",
    max_retries=0,
    silo_mode=SiloMode.REGION,
    soft_time_limit=60 * 15,
    time_limit=60 * (15 + 5),
    taskworker_config=TaskworkerConfig(
        namespace=seer_tasks,
        processing_deadline_duration=60 * (15 + 5),
    ),
)
def call_seer_delete_project_grouping_records(
    project_id: int,
    *args: Any,
    **kwargs: Any,
) -> None:
    if killswitch_enabled(project_id, ReferrerOptions.DELETION) or options.get(
        "seer.similarity-embeddings-delete-by-hash-killswitch.enabled"
    ):
        return

    logger.info("calling seer delete records by project", extra={"project_id": project_id})
    call_seer_to_delete_project_grouping_records(project_id)
