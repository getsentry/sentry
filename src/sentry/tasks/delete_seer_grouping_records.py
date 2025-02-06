import logging
from typing import Any

from sentry import options
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.grouping_records import (
    delete_grouping_records_by_hash,
    delete_project_grouping_records,
)
from sentry.seer.similarity.utils import ReferrerOptions, killswitch_enabled
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.delete_seer_grouping_records_by_hash",
    queue="delete_seer_grouping_records_by_hash",
    max_retries=0,
    silo_mode=SiloMode.REGION,
    soft_time_limit=60 * 15,
    time_limit=60 * (15 + 5),
)
def delete_seer_grouping_records_by_hash(
    project_id: int,
    hashes: list[str],
    last_deleted_index: int = 0,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Task to delete seer grouping records by hash list.
    Calls the seer delete by hash endpoint with batches of hashes of size `BATCH_SIZE`.
    """
    if killswitch_enabled(project_id, ReferrerOptions.DELETION) or options.get(
        "seer.similarity-embeddings-delete-by-hash-killswitch.enabled"
    ):
        return

    batch_size = options.get("embeddings-grouping.seer.delete-record-batch-size")
    len_hashes = len(hashes)
    end_index = min(last_deleted_index + batch_size, len_hashes)
    delete_grouping_records_by_hash(project_id, hashes[last_deleted_index:end_index])
    if end_index < len_hashes:
        delete_seer_grouping_records_by_hash.apply_async(args=[project_id, hashes, end_index])


def call_delete_seer_grouping_records_by_hash(
    group_ids: list[int],
) -> None:
    project = None
    if group_ids:
        group = Group.objects.get(id=group_ids[0])
        project = group.project if group else None
    if (
        project
        and project.get_option("sentry:similarity_backfill_completed")
        and not killswitch_enabled(project.id, ReferrerOptions.DELETION)
        and not options.get("seer.similarity-embeddings-delete-by-hash-killswitch.enabled")
    ):
        # TODO (jangjodi): once we store seer grouping info in GroupHash, we should filter by that here
        group_hash_objects = GroupHash.objects.filter(
            project_id=project.id, group__id__in=group_ids
        )
        group_hashes = [group_hash.hash for group_hash in group_hash_objects]
        logger.info(
            "calling seer record deletion by hash",
            extra={"project_id": project.id, "hashes": group_hashes},
        )
        if group_hashes:
            delete_seer_grouping_records_by_hash.apply_async(args=[project.id, group_hashes, 0])


@instrumented_task(
    name="sentry.tasks.call_seer_delete_project_grouping_records",
    queue="delete_seer_grouping_records_by_hash",
    max_retries=0,
    silo_mode=SiloMode.REGION,
    soft_time_limit=60 * 15,
    time_limit=60 * (15 + 5),
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
    delete_project_grouping_records(project_id)
