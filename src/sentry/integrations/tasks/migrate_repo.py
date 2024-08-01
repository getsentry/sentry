from sentry.integrations.models.integration import Integration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations.migrate_repo import migrate_repo as old_migrate_repo


@instrumented_task(
    name="sentry.integrations.tasks.migrate_repo",
    queue="integrations.control",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(Integration.DoesNotExist, Repository.DoesNotExist, Organization.DoesNotExist))
def migrate_repo(repo_id: int, integration_id: int, organization_id: int) -> None:
    old_migrate_repo(
        repo_id=repo_id, integration_id=integration_id, organization_id=organization_id
    )
