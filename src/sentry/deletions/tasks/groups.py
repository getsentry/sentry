from collections.abc import Mapping, Sequence
from typing import Any
from uuid import uuid4

import sentry_sdk

from sentry.deletions.tasks.scheduled import MAX_RETRIES, logger
from sentry.exceptions import DeleteAborted
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
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

    max_batch_size = 100
    current_batch, rest = object_ids[:max_batch_size], object_ids[max_batch_size:]

    # Select first_group from current_batch to ensure project_id tag reflects the current batch
    first_group = Group.objects.filter(id__in=current_batch).order_by("id").first()
    if not first_group:
        raise DeleteAborted("delete_groups.no_group_found")

    # The tags can be used if we want to find errors for when a task fails
    sentry_sdk.set_tags(
        {
            "project_id": first_group.project_id,
            "transaction_id": transaction_id,
        },
    )

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
