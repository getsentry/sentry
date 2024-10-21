from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.integrations.tasks import logger
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.integrations.tasks.migrate_repo",
    queue="integrations.control",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(Integration.DoesNotExist, Repository.DoesNotExist, Organization.DoesNotExist))
def migrate_repo(repo_id: int, integration_id: int, organization_id: int) -> None:
    from sentry.plugins.migrator import Migrator

    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        raise Integration.DoesNotExist
    installation = integration.get_installation(organization_id=organization_id)

    repo = repository_service.get_repository(organization_id=organization_id, id=repo_id)
    if repo is None:
        raise Repository.DoesNotExist

    # all RepositoryIntegrations should have this method
    if hasattr(installation, "has_repo_access") and installation.has_repo_access(repo):
        # This probably shouldn't happen, but log it just in case.
        if repo.integration_id is not None and repo.integration_id != integration_id:
            logger.info(
                "repo.migration.integration-change",
                extra={
                    "integration_id": integration_id,
                    "old_integration_id": repo.integration_id,
                    "organization_id": organization_id,
                    "repo_id": repo.id,
                },
            )

        repo.integration_id = integration_id
        repo.provider = f"integrations:{integration.provider}"
        # Check against disabled specifically -- don't want to accidentally un-delete repos.
        original_status = repo.status
        if repo.status == ObjectStatus.DISABLED:
            repo.status = ObjectStatus.ACTIVE
        repository_service.update_repository(organization_id=organization_id, update=repo)
        logger.info(
            "repo.migrated",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "repo_id": repo.id,
                "original_status": original_status,
            },
        )

        organization = organization_service.get(id=organization_id)
        if organization is None:
            raise Organization.DoesNotExist

        Migrator(integration=integration, organization=organization).run()
