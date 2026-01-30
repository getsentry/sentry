from collections.abc import Callable

from sentry import ratelimits
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
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


def is_rate_limited(
    organization_id: int,
    referrer: Referrer,
    provider: str,
    limit: int,
    window: int,
) -> bool:
    return ratelimits.backend.is_limited(
        f"scm_platform.{organization_id}.{referrer}.{provider}", limit=limit, window=window
    )


def is_rate_limited_with_allocation_policy(
    organization_id: int,
    referrer: Referrer,
    provider: str,
    window: int,
    allocation_policy: dict[Referrer, int],
) -> bool:
    # Check if the referrer has reserved quota they have exclusive access to.
    if referrer in allocation_policy:
        has_allocated_space = is_rate_limited(
            organization_id,
            referrer,
            provider,
            limit=allocation_policy[referrer],
            window=window,
        )
        if has_allocated_space:
            return True

    # Check if the shared pool has quota.
    return is_rate_limited(
        organization_id,
        referrer,
        provider,
        limit=allocation_policy["shared"],
        window=window,
    )


def map_integration_to_provider(
    organization_id: int,
    integration: Integration | RpcIntegration,
) -> Provider:
    client = integration.get_installation(organization_id=organization_id).get_client()

    if integration.provider == "github":
        return GitHubProvider(client)
    else:
        raise SCMUnsupportedIntegrationSpecified(integration.provider)


def map_repository_model_to_repository(repository: RepositoryModel) -> Repository:
    return {
        "integration_id": repository.integration_id,
        "name": repository.name,
        "organization_id": repository.organization_id,
        "status": repository.status,
    }


def fetch_service_provider(organization_id: int, integration_id: int) -> Provider:
    integration = integration_service.get_integration(
        integration_id=integration_id,
        organization_id=organization_id,
    )
    if not integration:
        raise SCMIntegrationNotFound()

    return map_integration_to_provider(organization_id, integration)


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

    return map_repository_model_to_repository(repo)


def exec_provider_fn[T](
    organization_id: int,
    repository_id: RepositoryId,
    *,
    referrer: Referrer = "shared",
    fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
    fetch_service_provider: Callable[[int, int], Provider] = fetch_service_provider,
    provider_fn: Callable[[Repository, Provider], T],
) -> T:
    repository = fetch_repository(organization_id, repository_id)
    if not repository:
        raise SCMRepositoryNotFound(organization_id, repository_id)
    if repository["status"] != "active":
        raise SCMRepositoryInactive(repository)
    if repository["organization_id"] != organization_id:
        raise SCMRepositoryOrganizationMismatch(repository)

    provider = fetch_service_provider(organization_id, repository["integration_id"])
    if provider.is_rate_limited(organization_id, referrer):
        raise SCMRateLimitExceeded(provider, organization_id, referrer)

    return provider_fn(repository, provider)
