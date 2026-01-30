from collections.abc import Callable

from sentry.scm.errors import (
    SCMRateLimitExceeded,
    SCMRepositoryInactive,
    SCMRepositoryNotFound,
    SCMRepositoryOrganizationMismatch,
)
from sentry.scm.helpers import fetch_repository, fetch_service_provider
from sentry.scm.types import Provider, Reaction, Referrer, Repository, RepositoryId


def create_issue_reaction(
    organization_id: int,
    repository_id: RepositoryId,
    issue_id: str,
    reaction: Reaction,
    *,
    referrer: Referrer = "shared",
    fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
    fetch_service_provider: Callable[[Repository], Provider] = fetch_service_provider,
):
    """Create an issue reaction."""
    repository = _fetch_repository(organization_id, repository_id, fetch_repository)

    provider = fetch_service_provider(repository)
    if provider.is_rate_limited(organization_id, referrer):
        raise SCMRateLimitExceeded(provider, organization_id, referrer)

    provider.create_issue_reaction(repository, issue_id, reaction)


def _fetch_repository(
    organization_id: int,
    repository_id: RepositoryId,
    fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
) -> Repository:
    repository = fetch_repository(organization_id, repository_id)
    if not repository:
        raise SCMRepositoryNotFound(organization_id, repository_id)
    if repository["status"] != "active":
        raise SCMRepositoryInactive(repository)
    if repository["organization_id"] != organization_id:
        raise SCMRepositoryOrganizationMismatch(repository)
    return repository
