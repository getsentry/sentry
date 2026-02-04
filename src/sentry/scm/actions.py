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
from sentry.scm.types import (
    Comment,
    Provider,
    PullRequest,
    Reaction,
    Referrer,
    Repository,
    RepositoryId,
)


class SourceCodeManager:

    def __init__(
        self,
        organization_id: int,
        repository_id: RepositoryId,
        *,
        referrer: Referrer = "shared",
        fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
        fetch_service_provider: Callable[[int, int], Provider] = fetch_service_provider,
    ):
        """
        The SourceCodeManager class manages ACLs, rate-limits, environment setup, and a
        vendor-agnostic mapping of actions to service-provider commands. The SourceCodeManager
        exposes a declarative interface. Developers declare what they want and the concrete
        implementation details of what's done are abstracted.

        :param self:
        :param organization_id:
        :type organization_id: int
        :param repository_id: Either the integer ID of a "Repository" model or a tuple of provider
        and the external-id.
        :type repository_id: RepositoryId
        :param referrer: Referrers specify who made a request. Referrers are used to log usage
        metrics and are used to allocate service-provider quota for critical products.
        :type referrer: Referrer
        :param fetch_repository: Translates a "RepositoryId" type into a "Respository" type.
        Fetches a repository from the store and validates it has a correct state.
        :type fetch_repository: Callable[[int, RepositoryId], Repository | None]
        :param fetch_service_provider: Translates a "Repository" type into a "Provider" instance.
        Abstracts integration lookup and API client acquisition.
        :type fetch_service_provider: Callable[[Repository], Provider]
        """
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
        repository_ = map_repository_model_to_repository(repository)
        provider = map_integration_to_provider(organization_id, integration)

        return cls(
            organization_id,
            repository.id,
            referrer=referrer,
            fetch_repository=lambda _, __: repository_,
            fetch_service_provider=lambda _, __: provider,
        )

    def get_issue_comments(self, issue_id: str) -> list[Comment]:
        """Get comments on an issue."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.get_issue_comments(r, issue_id),
        )

    def create_issue_comment(self, issue_id: str, body: str):
        """Create a comment on an issue."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.create_issue_comment(r, issue_id, body),
        )

    def delete_issue_comment(self, comment_id: str):
        """Delete a comment on an issue."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.delete_issue_comment(r, comment_id),
        )

    def get_pull_request(self, pull_request_id: int) -> PullRequest:
        """Get a pull request."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.get_pull_request(r, pull_request_id),
        )

    def get_pull_request_comments(self, pull_request_id: str):
        """Get comments on a pull request."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.get_pull_request_comments(r, pull_request_id),
        )

    def create_pull_request_comment(self, pull_request_id: str, body: str):
        """Create a comment on a pull request."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.create_pull_request_comment(r, pull_request_id, body),
        )

    def delete_pull_request_comment(self, comment_id: str):
        """Delete a comment on a pull request."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.delete_pull_request_comment(r, comment_id),
        )

    def get_comment_reactions(self, comment_id: str):
        """Get reactions on a comment."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.get_comment_reactions(r, comment_id),
        )

    def create_comment_reaction(self, comment_id: str, reaction: Reaction):
        """Create a reaction on a comment."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.create_comment_reaction(r, comment_id, reaction),
        )

    def delete_comment_reaction(self, comment_id: str, reaction: Reaction):
        """Delete a reaction on a comment."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.delete_comment_reaction(r, comment_id, reaction),
        )

    def get_issue_reactions(self, issue_id: str):
        """Get reactions on an issue."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.get_issue_reactions(r, issue_id),
        )

    def create_issue_reaction(self, issue_id: str, reaction: Reaction):
        """Create a reaction on an issue."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.create_issue_reaction(r, issue_id, reaction),
        )

    def delete_issue_reaction(self, issue_id: str, reaction: Reaction):
        """Delete a reaction on an issue."""
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=lambda r, p: p.delete_issue_reaction(r, issue_id, reaction),
        )
