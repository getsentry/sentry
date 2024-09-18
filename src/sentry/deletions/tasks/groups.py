from collections.abc import Mapping, Sequence
from typing import Any
from uuid import uuid4

from sentry.deletions.tasks.scheduled import MAX_RETRIES, logger
from sentry.exceptions import DeleteAborted
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation


@instrumented_task(
    name="sentry.deletions.tasks.groups.delete_groups",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
    silo_mode=SiloMode.REGION,
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

    logger.info(
        "delete_groups.started",
        extra={
            "object_ids_count": len(object_ids),
            "first_id": object_ids[0],
        },
    )

    transaction_id = transaction_id or uuid4().hex

    max_batch_size = 100
    current_batch, rest = object_ids[:max_batch_size], object_ids[max_batch_size:]

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
            countdown=15,
        )
    else:
        # all groups have been deleted
        if eventstream_state:
            eventstream.backend.end_delete_groups(eventstream_state)
