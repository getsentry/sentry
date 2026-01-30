from collections.abc import Callable

from sentry.integrations.services.integration.service import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import (
    SCMIntegrationNotFound,
    SCMRateLimitExceeded,
    SCMRepositoryInactive,
    SCMRepositoryNotFound,
    SCMRepositoryOrganizationMismatch,
    SCMUnsupportedIntegrationSpecified,
)
from sentry.scm.private.providers.github import GitHubProvider
from sentry.scm.types import ExternalId, Provider, ProviderName, Referrer, Repository, RepositoryId


def fetch_service_provider(integration_id: int, organization_id: int) -> Provider:
    integration = integration_service.get_integration(
        integration_id=integration_id,
        organization_id=organization_id,
    )
    if not integration:
        raise SCMIntegrationNotFound()

    client = integration.get_installation(organization_id=organization_id).get_client()

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


def exec_provider_fn[T](
    organization_id: int,
    repository_id: RepositoryId,
    *,
    referrer: Referrer = "shared",
    fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
    fetch_service_provider: Callable[[Repository], Provider] = fetch_service_provider,
    provider_fn: Callable[[Repository, Provider], T],
) -> T:
    repository = fetch_repository(organization_id, repository_id)
    if not repository:
        raise SCMRepositoryNotFound(organization_id, repository_id)
    if repository["status"] != "active":
        raise SCMRepositoryInactive(repository)
    if repository["organization_id"] != organization_id:
        raise SCMRepositoryOrganizationMismatch(repository)

    provider = fetch_service_provider(repository["integration_id"], repository["organization_id"])
    if provider.is_rate_limited(organization_id, referrer):
        raise SCMRateLimitExceeded(provider, organization_id, referrer)

    return provider_fn(repository, provider)
