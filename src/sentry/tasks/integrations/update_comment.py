from sentry.integrations.models.integration import Integration
from sentry.integrations.tasks.update_comment import update_comment as new_update_comment
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.update_comment",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(Integration.DoesNotExist))
def update_comment(external_issue_id: int, user_id: int, group_note_id: int) -> None:
    new_update_comment(external_issue_id, user_id, group_note_id)
