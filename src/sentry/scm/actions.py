from collections.abc import Callable

from sentry.scm.helpers import exec_provider_fn, fetch_repository, fetch_service_provider
from sentry.scm.types import Provider, Reaction, Referrer, Repository, RepositoryId


class SourceCodeManager:

    def __init__(
        self,
        organization_id: int,
        repository_id: RepositoryId,
        *,
        referrer: Referrer = "shared",
        fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
        fetch_service_provider: Callable[[Repository], Provider] = fetch_service_provider,
    ):
        self.organization_id = organization_id
        self.repository_id = repository_id
        self.referrer = referrer
        self.fetch_repository = fetch_repository
        self.fetch_service_provider = fetch_service_provider

    def create_issue_reaction(self, issue_id: str, reaction: Reaction):
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.create_issue_reaction(r, issue_id, reaction),
        )
