from collections.abc import Callable

from sentry.scm.helpers import exec_provider_fn, fetch_repository, fetch_service_provider
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
    """Create an issue reaction.

    :param organization_id:
    :param repository_id:
    :param issue_id:
    :param reaction:
    :param referrer:
    :param fetch_repository:
    :param fetch_service_provider:
    """
    return exec_provider_fn(
        organization_id,
        repository_id,
        referrer=referrer,
        fetch_repository=fetch_repository,
        fetch_service_provider=fetch_service_provider,
        provider_fn=lambda r, p: p.create_issue_reaction(r, issue_id, reaction),
    )
