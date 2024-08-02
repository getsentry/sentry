from sentry.integrations.models.integration import Integration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations.migrate_issues import migrate_issues as migrate_issues_old
from sentry.tasks.integrations.sync_metadata import sync_metadata as sync_metadata_old


@instrumented_task(
    name="sentry.integrations.jira.tasks.migrate_issues",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist))
def migrate_issues(integration_id: int, organization_id: int) -> None:
    migrate_issues_old(integration_id=integration_id, organization_id=organization_id)


@instrumented_task(
    name="sentry.integrations.jira.tasks.sync_metadata",
    queue="integrations.control",
    default_retry_delay=20,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry(on=(IntegrationError,), exclude=(Integration.DoesNotExist,))
def sync_metadata(integration_id: int) -> None:
    sync_metadata_old(integration_id=integration_id)
