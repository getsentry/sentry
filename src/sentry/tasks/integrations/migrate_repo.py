from sentry.constants import ObjectStatus
from sentry.models import Integration, Organization, Repository
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.repository import repository_service
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations import logger


@instrumented_task(
    name="sentry.tasks.integrations.migrate_repo",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist, Repository.DoesNotExist, Organization.DoesNotExist))
def migrate_repo(repo_id: int, integration_id: int, organization_id: int) -> None:
    from sentry.mediators.plugins import Migrator

    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        raise Integration.DoesNotExist
    installation = integration_service.get_installation(
        integration=integration, organization_id=organization_id
    )

    repo = repository_service.get_repository(organization_id=organization_id, id=repo_id)
    if repo is None:
        raise Repository.DoesNotExist

    if installation.has_repo_access(repo):
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

        Migrator.run(integration=integration, organization=organization)
