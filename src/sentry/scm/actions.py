from collections.abc import Callable
from typing import Self

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.helpers import (
    exec_provider_fn,
    fetch_repository,
    fetch_service_provider,
    map_integration_to_provider,
    map_repository_model_to_repository,
)
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

    @classmethod
    def make_from_repository_id(
        cls,
        organization_id: int,
        repository_id: RepositoryId,
        *,
        referrer: Referrer = "shared",
    ) -> Self:
        return cls(organization_id, repository_id, referrer=referrer)

    @classmethod
    def make_from_integration(
        cls,
        organization_id: int,
        repository: RepositoryModel,
        integration: Integration | RpcIntegration,
        *,
        referrer: Referrer = "shared",
    ) -> Self:
        return cls(
            organization_id,
            repository.id,
            referrer=referrer,
            fetch_repository=lambda _, __: map_repository_model_to_repository(repository),
            fetch_service_provider=lambda oid, _: map_integration_to_provider(oid, integration),
        )

    def create_issue_reaction(self, issue_id: str, reaction: Reaction):
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.create_issue_reaction(r, issue_id, reaction),
        )
