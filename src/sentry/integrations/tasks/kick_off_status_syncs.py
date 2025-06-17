from sentry.models.grouplink import GroupLink
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry


@instrumented_task(
    name="sentry.integrations.tasks.kick_off_status_syncs",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
        retry=Retry(
            times=5,
            delay=60 * 5,
        ),
    ),
)
@retry()
@track_group_async_operation
def kick_off_status_syncs(project_id: int, group_id: int) -> None:
    """This is run async to avoid extra queries in the EventManager."""
    from sentry.integrations.tasks.sync_status_outbound import sync_status_outbound

    external_issue_ids = GroupLink.objects.filter(
        project_id=project_id, group_id=group_id, linked_type=GroupLink.LinkedType.issue
    ).values_list("linked_id", flat=True)

    for external_issue_id in external_issue_ids:
        sync_status_outbound.apply_async(
            kwargs={"group_id": group_id, "external_issue_id": external_issue_id}
        )
