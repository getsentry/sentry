from collections.abc import Sequence
from typing import Any

import sentry_sdk

from sentry import deletions
from sentry.deletions.defaults.group import GROUP_CHUNK_SIZE
from sentry.deletions.tasks.scheduled import MAX_RETRIES, logger
from sentry.exceptions import DeleteAborted
from sentry.models.group import Group
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.taskworker.namespaces import deletion_tasks
from sentry.taskworker.retry import Retry


@instrumented_task(
    name="sentry.deletions.tasks.groups.delete_groups_for_project",
    namespace=deletion_tasks,
    retry=Retry(times=MAX_RETRIES, delay=60 * 5),
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(DeleteAborted,), timeouts=True)
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
