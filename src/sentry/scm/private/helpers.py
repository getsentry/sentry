import functools
from collections.abc import Callable
from typing import NamedTuple, cast

import sentry_sdk
from django.db.models import Q
from scm.errors import SCMCodedError, UnhandledException
from scm.providers.cursor_origin.provider import CursorOriginProvider
from scm.providers.github.provider import GitHubProvider
from scm.providers.gitlab.provider import GitLabProvider
from scm.types import Provider, Repository, RepositoryId

from sentry.constants import ObjectStatus
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.organization import Organization
from sentry.models.repository import Repository as RepositoryModel
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils import metrics

type IntegrationGetter = Callable[[int, int], RpcIntegration | None]


class Fetchers(NamedTuple):
    fetch_repository: Callable[[int, RepositoryId], Repository | None]
    fetch_provider: Callable[[int, Repository], Provider | None]


def make_fetchers() -> Fetchers:
    """Return the repository and provider lookups to build one SourceCodeManager with.

    Both lookups can need the repository's integration, and fetching it is an RPC to the control silo,
    so they share a single fetch. The integration stays cached for as long as the lookups live: make new
    ones for every SourceCodeManager, never share them across requests.
    """
    get_integration = functools.cache(_get_integration)
    return Fetchers(
        fetch_repository=functools.partial(fetch_repository, get_integration=get_integration),
        fetch_provider=functools.partial(fetch_service_provider, get_integration=get_integration),
    )


def _get_integration(organization_id: int, integration_id: int) -> RpcIntegration | None:
    return integration_service.get_integration(
        integration_id=integration_id,
        organization_id=organization_id,
    )


def fetch_service_provider(
    organization_id: int,
    repository: Repository,
    *,
    get_integration: IntegrationGetter = _get_integration,
) -> Provider | None:
    integration = get_integration(organization_id, repository["integration_id"])
    if not integration:
        return None

    try:
        client = integration.get_installation(organization_id=organization_id).get_client()
    except (IntegrationError, OrganizationIntegrationNotFound):
        return None

    if integration.provider in ("github", "github_enterprise"):
        return GitHubProvider(client, organization_id, repository)
    elif integration.provider == "gitlab":
        return GitLabProvider(client, organization_id, repository)
    elif integration.provider == "cursor_origin":
        return CursorOriginProvider(
            client, organization_id, repository, installation_id=integration.external_id
        )
    else:
        return None


def fetch_repository(
    organization_id: int,
    repository_id: RepositoryId,
    *,
    get_integration: IntegrationGetter = _get_integration,
) -> Repository | None:
    try:
        if isinstance(repository_id, int):
            repo = RepositoryModel.objects.get(organization_id=organization_id, id=repository_id)
        else:
            repo = RepositoryModel.objects.get(
                Q(external_id=repository_id[1]) | Q(name=repository_id[1]),
                organization_id=organization_id,
                provider=f"integrations:{repository_id[0]}",
            )
    except RepositoryModel.DoesNotExist:
        return None

    # Tag the current Sentry scope with the organization so that any exceptions
    # captured later in this request (e.g. ResourceForbidden from the SCM
    # provider) include the affected customer for distribution analysis.
    try:
        org = Organization.objects.get_from_cache(id=organization_id)
        sentry_sdk.set_tag("organization.slug", org.slug)
        sentry_sdk.set_tag("organization.id", organization_id)
    except Exception:
        pass

    # This state should be impossible, however, the invariant is not encoded into the data type.
    # If we encounter a null integration_id the repository is useless. Return "None" and let the
    # SCM fail gracefully. Failing to return "None" here could fetch _any_ integration belonging
    # to the organization.
    if not isinstance(repo.integration_id, int):
        return None

    # This state should be impossible, however, the invariant is not encoded into the data type.
    # If we encounter a null provider the repository is functionally useless and there is a
    # broader bug in the Sentry codebase. Return "None" and let the SCM fail gracefully.
    if not isinstance(repo.provider, str):
        return None

    provider_name = repo.provider.removeprefix("integrations:")
    web_base_url: str | None = None
    installation_id: str | None = None
    if provider_name == "github_enterprise":
        integration = get_integration(organization_id, repo.integration_id)
        if integration:
            domain_name = integration.metadata.get("domain_name")
            if domain_name:
                base_host = domain_name.split("/", 1)[0]
                web_base_url = f"https://{base_host}"
    elif provider_name == "gitlab":
        integration = integration_service.get_integration(
            integration_id=repo.integration_id,
            organization_id=organization_id,
        )
        if integration:
            # The same instance URL the GitLab API client and source links are built from, so it
            # keeps the scheme and any path prefix of a self-hosted instance. Installs from older
            # pipelines may have saved it with a trailing slash.
            base_url = integration.metadata.get("base_url")
            if base_url:
                web_base_url = base_url.rstrip("/")
    elif provider_name == "cursor_origin":
        integration = get_integration(organization_id, repo.integration_id)
        if integration:
            installation_id = integration.external_id

    repository: dict[str, object] = {
        "external_id": repo.external_id,
        "id": repo.id,
        "integration_id": repo.integration_id,
        "is_active": repo.status == ObjectStatus.ACTIVE,
        "name": repo.name,
        "organization_id": repo.organization_id,
        "provider_name": provider_name,
        "web_base_url": web_base_url,
        "installation_id": installation_id,
    }
    # A GitLab repository's name is its display name ("Group / Project"), which can't be used to
    # address the project on its host, e.g. in a clone URL. The project's real path is only kept
    # in its config.
    if provider_name == "gitlab":
        repository["path"] = repo.config.get("path")

    return cast(Repository, repository)


def report_error_to_sentry(e: Exception) -> None:
    if not isinstance(e, SCMCodedError) or isinstance(e, UnhandledException):
        sentry_sdk.capture_exception(e)


def record_count_metric(key: str, amount: int, tags: dict[str, str]) -> None:
    metrics.incr(key, amount, tags=tags)


def record_distribution_metric(key: str, amount: int, tags: dict[str, str], unit: str) -> None:
    metrics.distribution(key, amount, tags=tags, unit=unit)


def record_timer_metric(key: str, amount: float, tags: dict[str, str]) -> None:
    metrics.distribution(key, amount, tags=tags)
