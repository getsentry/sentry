from sentry.models import GroupLink
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation


@instrumented_task(
    name="sentry.tasks.integrations.kick_off_status_syncs",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry()
@track_group_async_operation
def kick_off_status_syncs(project_id: int, group_id: int) -> None:
    """This is run async to avoid extra queries in the EventManager."""
    from sentry.tasks.integrations import sync_status_outbound

    external_issue_ids = GroupLink.objects.filter(
        project_id=project_id, group_id=group_id, linked_type=GroupLink.LinkedType.issue
    ).values_list("linked_id", flat=True)

    for external_issue_id in external_issue_ids:
        sync_status_outbound.apply_async(
            kwargs={"group_id": group_id, "external_issue_id": external_issue_id}
        )
