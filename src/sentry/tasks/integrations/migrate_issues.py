from sentry.integrations.jira.tasks import migrate_issues as migrate_issues_new
from sentry.integrations.models.integration import Integration
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.migrate_issues",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist))
def migrate_issues(integration_id: int, organization_id: int) -> None:
    migrate_issues_new(integration_id=integration_id, organization_id=organization_id)
