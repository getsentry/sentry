from sentry.integrations.services.integration.service import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMIntegrationNotFound, SCMUnsupportedIntegrationSpecified
from sentry.scm.private.providers.github import GitHubProvider
from sentry.scm.types import ExternalId, Provider, ProviderName, Repository


def fetch_service_provider(repository: Repository) -> Provider:
    integration = integration_service.get_integration(
        integration_id=repository["integration_id"],
        organization_id=repository["organization_id"],
    )
    if not integration:
        raise SCMIntegrationNotFound()

    client = integration.get_installation(
        organization_id=repository["organization_id"]
    ).get_client()

    if integration.provider == "github":
        return GitHubProvider(client)
    else:
        raise SCMUnsupportedIntegrationSpecified(integration.provider)


def fetch_repository(
    organization_id: int, repository_id: int | tuple[ProviderName, ExternalId]
) -> Repository | None:
    try:
        if isinstance(repository_id, int):
            repo = RepositoryModel.objects.get(organization_id=organization_id, id=repository_id)
        else:
            repo = RepositoryModel.objects.get(
                organization_id=organization_id,
                provider=repository_id[0],
                external_id=repository_id[1],
            )
    except RepositoryModel.DoesNotExist:
        return None

    assert isinstance(repo, RepositoryModel)

    return {
        "integration_id": repo.integration_id,
        "name": repo.name,
        "organization_id": repo.organization_id,
        "status": repo.status,
    }
