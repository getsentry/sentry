from collections.abc import Callable

from sentry import ratelimits
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMCodedError, SCMError, SCMUnhandledException
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
    if referrer != "shared" and referrer in allocation_policy:
        is_allocation_exhausted = is_rate_limited(
            organization_id,
            referrer,
            provider,
            limit=allocation_policy[referrer],
            window=window,
        )
        if not is_allocation_exhausted:
            return False

    # Check if the shared pool has quota.
    return is_rate_limited(
        organization_id,
        "shared",
        provider,
        limit=allocation_policy["shared"],
        window=window,
    )


def map_integration_to_provider(
    organization_id: int,
    integration: Integration | RpcIntegration,
    repository: Repository,
    get_installation: Callable[
        [Integration | RpcIntegration, int], IntegrationInstallation
    ] = lambda i, oid: i.get_installation(organization_id=oid),
) -> Provider:
    client = get_installation(integration, organization_id).get_client()

    if integration.provider == "github":
        return GitHubProvider(client, repository)
    else:
        raise SCMCodedError(integration.provider, code="integration_not_found")


def map_repository_model_to_repository(repository: RepositoryModel) -> Repository:
    return {
        "integration_id": repository.integration_id,
        "name": repository.name,
        "organization_id": repository.organization_id,
        "status": repository.status,
    }


def fetch_service_provider(
    organization_id: int,
    repository: Repository,
    map_to_provider: Callable[[Integration | RpcIntegration, int, Repository], Provider] = lambda i,
    oid,
    r: map_integration_to_provider(oid, i, r),
) -> Provider:
    integration = integration_service.get_integration(
        integration_id=repository["integration_id"],
        organization_id=organization_id,
    )
    if not integration:
        raise SCMCodedError(code="unsupported_integration")

    return map_to_provider(integration, organization_id, repository)


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


def exec_provider_fn[T](
    organization_id: int,
    repository_id: RepositoryId,
    *,
    referrer: Referrer = "shared",
    fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
    fetch_service_provider: Callable[[int, Repository], Provider] = fetch_service_provider,
    provider_fn: Callable[[Provider], T],
) -> T:
    repository = fetch_repository(organization_id, repository_id)
    if not repository:
        raise SCMCodedError(organization_id, repository_id, code="repository_not_found")
    if repository["status"] != ObjectStatus.ACTIVE:
        raise SCMCodedError(repository, code="repository_inactive")
    if repository["organization_id"] != organization_id:
        raise SCMCodedError(repository, code="repository_organization_mismatch")

    provider = fetch_service_provider(organization_id, repository)
    if provider.is_rate_limited(organization_id, referrer):
        raise SCMCodedError(provider, organization_id, referrer, code="rate_limit_exceeded")

    try:
        return provider_fn(provider)
    except SCMError:
        raise
    except Exception as e:
        raise SCMUnhandledException from e
