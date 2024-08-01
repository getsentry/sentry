from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.tasks.integrations.kick_off_status_syncs_impl import (
    kick_off_status_syncs as old_kick_off_status_syncs,
)


@instrumented_task(
    name="sentry.integrations.tasks.kick_off_status_syncs",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry()
@track_group_async_operation
def kick_off_status_syncs(project_id: int, group_id: int) -> None:
    old_kick_off_status_syncs(project_id=project_id, group_id=group_id)
