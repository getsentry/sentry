from sentry.integrations.tasks.migrate_issues import migrate_issues as new_migrate_issues
from sentry.models.integrations.integration import Integration
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.migrate_issues",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist))
def migrate_issues(integration_id: int, organization_id: int) -> None:
    new_migrate_issues(integration_id, organization_id)
