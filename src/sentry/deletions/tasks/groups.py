from collections.abc import Mapping, Sequence
from typing import Any
from uuid import uuid4

import sentry_sdk

from sentry.deletions.tasks.scheduled import MAX_RETRIES, logger
from sentry.exceptions import DeleteAborted
from sentry.issues.grouptype import GroupCategory
from sentry.models.grouphash import GroupHash
from sentry.models.groupinbox import GroupInbox
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.tasks.delete_seer_grouping_records import call_delete_seer_grouping_records_by_hash
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import deletion_tasks
from sentry.taskworker.retry import Retry


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
def delete_groups(
    object_ids: Sequence[int],
    transaction_id: str | None = None,
    eventstream_state: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> None:
    from sentry import deletions, eventstream
    from sentry.models.group import Group

    first_group = Group.objects.get(id=object_ids[0])
    # The tags can be used if we want to find errors for when a task fails
    sentry_sdk.set_tags(
        {
            "project_id": first_group.project_id,
            "transaction_id": transaction_id,
        },
    )

    max_batch_size = 100
    current_batch, rest = object_ids[:max_batch_size], object_ids[max_batch_size:]
    transaction_id = transaction_id or uuid4().hex

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

    # Perform cleanup operations before deletion to prevent blocking
    # if these operations fail
    try:
        # Get all groups in the current batch to determine error groups and project
        groups = list(Group.objects.filter(id__in=current_batch))
        if groups:
            project_id = groups[0].project_id

            # Tell seer to delete grouping records for error groups
            error_ids = []
            for group in groups:
                if group.issue_category == GroupCategory.ERROR:
                    error_ids.append(group.id)

            if error_ids:
                call_delete_seer_grouping_records_by_hash(error_ids)

            # Removing GroupHash rows prevents new events from associating to the groups
            # we are about to delete.
            GroupHash.objects.filter(project_id=project_id, group__id__in=current_batch).delete()

            # We remove `GroupInbox` rows here so that they don't end up influencing queries for
            # `Group` instances that are pending deletion
            GroupInbox.objects.filter(project_id=project_id, group__id__in=current_batch).delete()
    except Exception as e:
        logger.warning(
            "delete_groups.cleanup_failed",
            extra={
                "object_ids_current_batch": current_batch,
                "project_id": first_group.project_id,
                "transaction_id": transaction_id,
                "error": str(e),
            },
        )
        # Continue with deletion even if cleanup fails

    task = deletions.get(
        model=Group, query={"id__in": current_batch}, transaction_id=transaction_id
    )
    has_more = task.chunk()
    if has_more or rest:
        delete_groups.apply_async(
            kwargs={
                "object_ids": object_ids if has_more else rest,
                "transaction_id": transaction_id,
                "eventstream_state": eventstream_state,
            },
        )
    else:
        # all groups have been deleted
        if eventstream_state:
            eventstream.backend.end_delete_groups(eventstream_state)
