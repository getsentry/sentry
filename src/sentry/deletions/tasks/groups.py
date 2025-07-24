from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk

from sentry import eventstream
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
    name="sentry.deletions.tasks.groups.delete_groups_old",
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
def delete_groups_old(
    object_ids: Sequence[int],
    transaction_id: str,
    eventstream_state: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> None:
    from sentry import deletions
    from sentry.models.group import Group

    current_batch, rest = object_ids[:GROUP_CHUNK_SIZE], object_ids[GROUP_CHUNK_SIZE:]

    # Select first_group from current_batch to ensure project_id tag reflects the current batch
    first_group = Group.objects.filter(id__in=current_batch).order_by("id").first()
    if not first_group:
        raise DeleteAborted("delete_groups.no_group_found")

    # This is a no-op on the Snuba side, however, one day it may not be.
    eventstream_state = eventstream.backend.start_delete_groups(first_group.project_id, object_ids)

    # The tags can be used if we want to find errors for when a task fails
    sentry_sdk.set_tags(
        {
            "project_id": first_group.project_id,
            "transaction_id": transaction_id,
        },
    )

    logger.info(
        "delete_groups.started",
        extra={
            "object_ids_count": len(object_ids),
            "object_ids_current_batch": current_batch,
            "first_id": first_group.id,
            # These can be used when looking for logs in GCP
            "project_id": first_group.project_id,
            # All tasks initiated by the same request will have the same transaction_id
            "transaction_id": transaction_id,
        },
    )

    task = deletions.get(
        model=Group, query={"id__in": current_batch}, transaction_id=transaction_id
    )
    has_more = task.chunk()
    if has_more or rest:
        # I want confirmation that this is not happening since the deletion task
        # uses the same chunking logic.
        metrics.incr("deletions.groups.delete_groups_old.chunked", 1, sample_rate=1)
        sentry_sdk.capture_message(
            "This should not be happening",
            level="info",
            # Use this to query the logs
            tags={"transaction_id": transaction_id},
        )
        delete_groups_old.apply_async(
            kwargs={
                "object_ids": object_ids if has_more else rest,
                "project_id": first_group.project_id,
                "transaction_id": transaction_id,
            },
        )
    else:
        # This will delete all Snuba events for all deleted groups
        eventstream.backend.end_delete_groups(eventstream_state)


@instrumented_task(
    name="sentry.deletions.tasks.groups.delete_groups",
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
def delete_groups_for_project_task(
    object_ids: Sequence[int],
    transaction_id: str,
    project_id: int | None = None,  # XXX: Make it mandatory later
    eventstream_state: Mapping[str, Any] | None = None,  # XXX: We will remove it later
    **kwargs: Any,
) -> None:
    groups = Group.objects.filter(id__in=object_ids).order_by("id")
    if project_id:
        if not all(group.project_id == project_id for group in groups):
            raise DeleteAborted("delete_groups.project_id_mismatch")
    else:
        # XXX: We will remove this block later
        # Select first_group from object_ids to get the project_id
        first_group = groups.first()
        if not first_group:
            raise DeleteAborted("delete_groups.no_group_found")
        project_id = first_group.project_id

    assert project_id is not None, "project_id is required"

    delete_groups_old(
        object_ids=object_ids,
        transaction_id=transaction_id,
        eventstream_state=eventstream_state,
        project_id=project_id,
        **kwargs,
    )
