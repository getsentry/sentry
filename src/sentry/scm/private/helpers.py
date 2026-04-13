from collections.abc import Callable

from scm.providers.github.provider import GitHubProvider
from scm.providers.gitlab.provider import GitLabProvider

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMCodedError
from sentry.scm.private.rate_limit import RateLimitProvider, RedisRateLimitProvider
from sentry.scm.types import ExternalId, Provider, ProviderName, Repository


def map_integration_to_provider(
    organization_id: int,
    integration: Integration | RpcIntegration,
    repository: Repository,
    get_installation: Callable[
        [Integration | RpcIntegration, int], IntegrationInstallation
    ] = lambda i, oid: i.get_installation(organization_id=oid),
    rate_limit_provider: RateLimitProvider | None = None,
) -> Provider:
    client = get_installation(integration, organization_id).get_client()

    if integration.provider == "github":
        return GitHubProvider(
            client,
            organization_id,
            repository,
            rate_limit_provider=rate_limit_provider or RedisRateLimitProvider(),
        )
    elif integration.provider == "gitlab":
        return GitLabProvider(client, organization_id, repository)
    else:
        raise SCMCodedError(integration.provider, code="unsupported_integration")


def map_repository_model_to_repository(repository: RepositoryModel) -> Repository:
    return {
        "external_id": repository.external_id,
        "id": repository.id,
        "integration_id": repository.integration_id,
        "is_active": repository.status == ObjectStatus.ACTIVE,
        "name": repository.name,
        "organization_id": repository.organization_id,
        "provider_name": repository.provider.removeprefix("integrations:"),
    }


def fetch_service_provider(
    organization_id: int,
    repository: Repository,
    map_to_provider: Callable[[Integration | RpcIntegration, int, Repository], Provider] = lambda i,
    oid,
    r: map_integration_to_provider(oid, i, r),
) -> Provider | None:
    integration = integration_service.get_integration(
        integration_id=repository["integration_id"],
        organization_id=organization_id,
    )
    return map_to_provider(integration, organization_id, repository) if integration else None


def fetch_repository(
    organization_id: int, repository_id: int | tuple[ProviderName, ExternalId]
) -> Repository | None:
    try:
        if isinstance(repository_id, int):
            repo = RepositoryModel.objects.get(organization_id=organization_id, id=repository_id)
        else:
            repo = RepositoryModel.objects.get(
                organization_id=organization_id,
                provider=f"integrations:{repository_id[0]}",
                external_id=repository_id[1],
            )
    except RepositoryModel.DoesNotExist:
        return None

    return map_repository_model_to_repository(repo)
