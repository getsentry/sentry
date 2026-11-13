from collections.abc import Sequence
from typing import Any

import sentry_sdk
from django.db import router, transaction
from taskbroker_client.retry import Retry
from taskbroker_client.state import current_task
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry import deletions
from sentry.deletions.defaults.group import GROUP_CHUNK_SIZE
from sentry.deletions.tasks.scheduled import MAX_RETRIES, logger
from sentry.exceptions import DeleteAborted
from sentry.locks import locks
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.groupinbox import GroupInbox
from sentry.models.grouptombstone import GroupTombstone
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, track_group_async_operation
from sentry.taskworker.namespaces import deletion_tasks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

DISCARD_GROUP_HASH_BATCH_SIZE = 1000
DISCARD_GROUP_TASK_DURATION_S = 15 * 60


@instrumented_task(
    name="sentry.deletions.tasks.groups.delete_groups_for_project",
    namespace=deletion_tasks,
    retry=Retry(
        times=MAX_RETRIES,
        delay=60 * 5,
        on=(
            Exception,
            ProcessingDeadlineExceeded,
        ),
        ignore=(DeleteAborted,),
    ),
    silo_mode=SiloMode.CELL,
    silenced_exceptions=(DeleteAborted,),
)
@track_group_async_operation
def delete_groups_for_project(
    project_id: int,
    object_ids: Sequence[int],
    transaction_id: str,
    **kwargs: Any,
) -> None:
    """
    Delete groups belonging to a single project.

    This interface enforces project-level constraints to ensure all groups
    being deleted belong to the same project.

    Args:
        project_id:         Project ID that all groups must belong to.
        object_ids:         List of group IDs to delete
        transaction_id:     Unique identifier to help debug deletion tasks
    """
    if not object_ids:
        raise DeleteAborted("delete_groups.empty_object_ids")

    groups = Group.objects.filter(id__in=object_ids).select_related("project")

    if not groups.exists():
        raise DeleteAborted("delete_groups.no_groups_found")

    # Validate all groups belong to the same project
    invalid_groups = groups.exclude(project_id=project_id)
    if invalid_groups.exists():
        raise DeleteAborted(
            f"delete_groups.project_id_mismatch: {len(invalid_groups)} groups "
            f"don't belong to project {project_id}"
        )

    # Task scheduling enforces that chunks do not exceed this size
    if len(object_ids) > GROUP_CHUNK_SIZE:
        raise DeleteAborted(
            f"delete_groups.object_ids_too_large: {len(object_ids)} groups "
            f"is greater than GROUP_CHUNK_SIZE"
        )

    # These can be used for debugging
    extra = {"project_id": project_id, "transaction_id": transaction_id}
    sentry_sdk.set_tags(extra)
    logger.info("delete_groups.started", extra={"object_ids": object_ids, **extra})
    task = deletions.get(model=Group, query={"id__in": object_ids}, transaction_id=transaction_id)
    has_more = True
    while has_more:
        has_more = task.chunk()


@instrumented_task(
    name="sentry.deletions.tasks.groups.discard_group",
    namespace=deletion_tasks,
    processing_deadline_duration=DISCARD_GROUP_TASK_DURATION_S,
    retry=Retry(
        times=MAX_RETRIES,
        delay=60 * 5,
        on=(
            Exception,
            ProcessingDeadlineExceeded,
        ),
    ),
    silo_mode=SiloMode.CELL,
)
def discard_group(
    group_id: int,
    project_id: int,
    tombstone_id: int,
    transaction_id: str,
    **kwargs: Any,
) -> None:
    """
    Move a discarded group's hashes to its tombstone, then schedule the group's deletion.

    Safe to run again for the same group: it continues with the hashes that have not moved yet.
    """
    lock = locks.get(
        f"discard-group:{group_id}",
        duration=DISCARD_GROUP_TASK_DURATION_S,
        name="discard_group",
    )
    extra = {"group_id": group_id, "tombstone_id": tombstone_id, "transaction_id": transaction_id}
    try:
        with lock.acquire():
            _discard_group(group_id, project_id, tombstone_id, transaction_id)
    except UnableToAcquireLock:
        # Another copy of this task is already discarding the group.
        metrics.incr("deletions.discard_group.lock_unavailable", sample_rate=1.0)
    except (Exception, ProcessingDeadlineExceeded):
        task = current_task()
        if task is None or not task.retries_remaining:
            logger.exception("discard_group.retries_exhausted", extra=extra)
            metrics.incr("deletions.discard_group.retries_exhausted", sample_rate=1.0)
        raise


def _discard_group(group_id: int, project_id: int, tombstone_id: int, transaction_id: str) -> None:
    if not Group.objects.filter(id=group_id, project_id=project_id).exists():
        return

    # A group can have so many hashes that one UPDATE exceeds the statement timeout. Each batch
    # commits on its own, so a retry continues instead of starting over.
    while True:
        with transaction.atomic(router.db_for_write(GroupHash)):
            # The tombstone stays locked until the batch commits, so an undiscard can't run between
            # this check and the update. An undiscarded issue keeps its group and remaining hashes.
            if not list(
                GroupTombstone.objects.select_for_update()
                .filter(id=tombstone_id)
                .values_list("id", flat=True)
            ):
                logger.info(
                    "discard_group.tombstone_deleted",
                    extra={"group_id": group_id, "tombstone_id": tombstone_id},
                )
                metrics.incr("deletions.discard_group.tombstone_deleted", sample_rate=1.0)
                return
            hash_ids = list(
                GroupHash.objects.filter(group_id=group_id).values_list("id", flat=True)[
                    :DISCARD_GROUP_HASH_BATCH_SIZE
                ]
            )
            if not hash_ids:
                break
            GroupHash.objects.filter(id__in=hash_ids, group_id=group_id).update(
                group=None, group_tombstone_id=tombstone_id
            )

    deletion_statuses = [GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]
    if Group.objects.filter(id=group_id, status__in=deletion_statuses).exists():
        # An earlier run already scheduled the deletion. Scheduling another could overlap with it.
        return

    # Schedule the deletion before marking the group pending, so a run that stops in between
    # schedules it again on retry rather than leaving a pending group that nothing deletes.
    # Mark the group pending deletion only after every hash has moved: deleting a group also
    # deletes the hashes still attached to it, and `delete_pending_groups` deletes any group
    # left pending.
    delete_groups_for_project.apply_async(
        kwargs={
            "project_id": project_id,
            "object_ids": [group_id],
            "transaction_id": transaction_id,
        }
    )
    Group.objects.filter(id=group_id).exclude(status__in=deletion_statuses).update(
        status=GroupStatus.PENDING_DELETION, substatus=None
    )
    GroupInbox.objects.filter(project_id=project_id, group_id=group_id).delete()
