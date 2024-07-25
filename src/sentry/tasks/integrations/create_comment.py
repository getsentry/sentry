from sentry.integrations.tasks.create_comment import create_comment as new_create_comment
from sentry.silo.base import SiloMode, region_silo_function
from sentry.tasks.base import instrumented_task


@region_silo_function
@instrumented_task(
    name="sentry.tasks.integrations.create_comment",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
def create_comment(external_issue_id: int, user_id: int, group_note_id: int) -> None:
    new_create_comment(external_issue_id, user_id, group_note_id)
