from collections.abc import Callable

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMCodedError, SCMError, SCMUnhandledException
from sentry.scm.private.ipc import record_count_metric
from sentry.scm.private.provider import Provider
from sentry.scm.private.providers.github import GitHubProvider
from sentry.scm.private.providers.gitlab import GitLabProvider
from sentry.scm.private.rate_limit import RateLimitProvider, RedisRateLimitProvider
from sentry.scm.types import ExternalId, ProviderName, Referrer, Repository, RepositoryId


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
        "integration_id": repository.integration_id,
        "name": repository.name,
        "organization_id": repository.organization_id,
        "is_active": repository.status == ObjectStatus.ACTIVE,
        "external_id": repository.external_id,
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


def initialize_provider(
    organization_id: int,
    repository_id: RepositoryId,
    *,
    fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
    fetch_service_provider: Callable[[int, Repository], Provider | None] = fetch_service_provider,
) -> Provider:
    repository = fetch_repository(organization_id, repository_id)
    if not repository:
        raise SCMCodedError(organization_id, repository_id, code="repository_not_found")
    if not repository["is_active"]:
        raise SCMCodedError(repository, code="repository_inactive")
    if repository["organization_id"] != organization_id:
        raise SCMCodedError(repository, code="repository_organization_mismatch")

    provider = fetch_service_provider(organization_id, repository)
    if provider is None:
        raise SCMCodedError(code="integration_not_found")

    return provider


def exec_provider_fn[P: Provider, T](
    provider: P,
    *,
    referrer: Referrer = "shared",
    provider_fn: Callable[[], T],
    record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
) -> T:
    if provider.is_rate_limited(referrer):
        raise SCMCodedError(provider, referrer, code="rate_limit_exceeded")

    try:
        result = provider_fn()
        record_count(
            "sentry.scm.actions.success_by_provider", 1, {"provider": provider.__class__.__name__}
        )
        record_count("sentry.scm.actions.success_by_referrer", 1, {"referrer": referrer})
        return result
    except SCMError:
        raise
    except Exception as e:
        record_count("sentry.scm.actions.failed", 1, {})
        raise SCMUnhandledException from e
