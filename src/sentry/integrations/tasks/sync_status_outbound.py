from sentry.integrations.models.integration import Integration
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.tasks.integrations.sync_status_outbound import (
    sync_status_outbound as old_sync_status_outbound,
)


@instrumented_task(
    name="sentry.integrations.tasks.sync_status_outbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(Integration.DoesNotExist,))
@track_group_async_operation
def sync_status_outbound(group_id: int, external_issue_id: int) -> bool | None:
    return old_sync_status_outbound(group_id=group_id, external_issue_id=external_issue_id)
