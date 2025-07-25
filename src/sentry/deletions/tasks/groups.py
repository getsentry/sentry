from collections.abc import Sequence
from typing import Any

import sentry_sdk

from sentry import deletions, eventstream
from sentry.deletions.defaults.group import GROUP_CHUNK_SIZE
from sentry.deletions.tasks.scheduled import MAX_RETRIES, logger
from sentry.exceptions import DeleteAborted
from sentry.models.group import Group
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import deletion_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics


@instrumented_task(
    name="sentry.deletions.tasks.groups.delete_groups_for_project",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=deletion_tasks,
        retry=Retry(
            times=MAX_RETRIES,
            delay=60 * 5,
        ),
    ),
)
@retry(exclude=(DeleteAborted,))
@track_group_async_operation
def delete_groups_for_project(
    project_id: int,
    object_ids: Sequence[int],
    transaction_id: str,
    **kwargs: Any,
) -> None:
    """
    Delete groups belonging to a single project.

    This is the new interface for group deletion that enforces project-level
    constraints. It will eventually replace delete_groups_old.

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

    # The new scheduling will not be scheduling more than this size
    if len(object_ids) > GROUP_CHUNK_SIZE:
        raise DeleteAborted(
            f"delete_groups.object_ids_too_large: {len(object_ids)} groups "
            f"is greater than GROUP_CHUNK_SIZE"
        )

    # This is a no-op on the Snuba side, however, one day it may not be.
    eventstream_state = eventstream.backend.start_delete_groups(project_id, object_ids)

    # These can be used for debugging
    extra = {"project_id": project_id, "transaction_id": transaction_id}
    sentry_sdk.set_tags(extra)
    logger.info("delete_groups.started", extra={"object_ids": object_ids, **extra})

    task = deletions.get(model=Group, query={"id__in": object_ids}, transaction_id=transaction_id)
    has_more = task.chunk()

    # XXX: Delete this block once I'm convince this is not happening
    if has_more:
        metrics.incr("deletions.groups.delete_groups_for_project.chunked", 1, sample_rate=1)
        sentry_sdk.capture_message(
            "This should not be happening",
            level="info",
            # Use this to query the logs
            tags={"transaction_id": transaction_id},
        )

    # This will delete all Snuba events for all deleted groups
    eventstream.backend.end_delete_groups(eventstream_state)
