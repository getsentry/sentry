from sentry.integrations.tasks.migrate_repo import migrate_repo as new_migrate_repo
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.migrate_repo",
    queue="integrations.control",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(Integration.DoesNotExist, Repository.DoesNotExist, Organization.DoesNotExist))
def migrate_repo(repo_id: int, integration_id: int, organization_id: int) -> None:
    new_migrate_repo(repo_id, integration_id, organization_id)
