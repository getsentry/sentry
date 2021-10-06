from sentry.models import Integration, ObjectStatus, Organization, Repository
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
    integration = Integration.objects.get(id=integration_id)
    installation = integration.get_installation(organization_id=organization_id)
    repo = Repository.objects.get(id=repo_id)
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
            repo.status = ObjectStatus.VISIBLE
        repo.save()
        logger.info(
            "repo.migrated",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "repo_id": repo.id,
                "original_status": original_status,
            },
        )

        from sentry.mediators.plugins import Migrator

        Migrator.run(
            integration=integration, organization=Organization.objects.get(id=organization_id)
        )
