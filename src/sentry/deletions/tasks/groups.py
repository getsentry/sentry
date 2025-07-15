from collections.abc import Mapping, Sequence
from typing import Any

from sentry.deletions.tasks.scheduled import MAX_RETRIES
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
    """
    This task is used to delete groups in bulk.

    Pass eventstream_state to the task in order to be notified when the groups have been deleted.
    """
    from sentry import deletions, eventstream
    from sentry.models.group import Group

    groups_left = True
    while groups_left:
        task = deletions.get(model=Group, query={"id__in": object_ids})
        groups_left = task.chunk()

    if eventstream_state:
        eventstream.backend.end_delete_groups(eventstream_state)
