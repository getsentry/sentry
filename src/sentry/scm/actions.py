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
    CheckRunActionResult,
    CheckRunOutput,
    CommentActionResult,
    CommitActionResult,
    CommitComparisonActionResult,
    FileContentActionResult,
    GitBlobActionResult,
    GitCommitObjectActionResult,
    GitRefActionResult,
    GitTreeActionResult,
    InputTreeEntry,
    Provider,
    PullRequestActionResult,
    PullRequestCommitActionResult,
    PullRequestDiffActionResult,
    PullRequestFileActionResult,
    Reaction,
    ReactionResult,
    Referrer,
    Repository,
    RepositoryId,
    ReviewActionResult,
    ReviewCommentActionResult,
    ReviewCommentInput,
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
        :param fetch_repository: Translates a "RepositoryId" type into a "Repository" type.
        Fetches a repository from the store and validates it has a correct state.
        :type fetch_repository: Callable[[int, RepositoryId], Repository | None]
        :param fetch_service_provider: Translates a "Repository" type into a "Provider" instance.
        Abstracts integration lookup and API client acquisition.
        :type fetch_service_provider: Callable[[int, int], Provider]
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

    def _exec[T](self, provider_fn: Callable[[Repository, Provider], T]) -> T:
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=provider_fn,
        )

    def get_issue_comments(self, issue_id: str) -> list[CommentActionResult]:
        """Get comments on an issue."""
        return self._exec(lambda r, p: p.get_issue_comments(r, issue_id))

    def create_issue_comment(self, issue_id: str, body: str) -> None:
        """Create a comment on an issue."""
        return self._exec(lambda r, p: p.create_issue_comment(r, issue_id, body))

    def delete_issue_comment(self, comment_id: str) -> None:
        """Delete a comment on an issue."""
        return self._exec(lambda r, p: p.delete_issue_comment(r, comment_id))

    def get_pull_request(self, pull_request_id: str) -> PullRequestActionResult:
        """Get a pull request."""
        return self._exec(lambda r, p: p.get_pull_request(r, pull_request_id))

    def get_pull_request_comments(self, pull_request_id: str) -> list[CommentActionResult]:
        """Get comments on a pull request."""
        return self._exec(lambda r, p: p.get_pull_request_comments(r, pull_request_id))

    def create_pull_request_comment(self, pull_request_id: str, body: str) -> None:
        """Create a comment on a pull request."""
        return self._exec(lambda r, p: p.create_pull_request_comment(r, pull_request_id, body))

    def delete_pull_request_comment(self, comment_id: str) -> None:
        """Delete a comment on a pull request."""
        return self._exec(lambda r, p: p.delete_pull_request_comment(r, comment_id))

    def get_issue_comment_reactions(self, comment_id: str) -> list[ReactionResult]:
        """Get reactions on an issue comment."""
        return self._exec(lambda r, p: p.get_issue_comment_reactions(r, comment_id))

    def create_issue_comment_reaction(self, comment_id: str, reaction: Reaction) -> None:
        """Create a reaction on an issue comment."""
        return self._exec(lambda r, p: p.create_issue_comment_reaction(r, comment_id, reaction))

    def delete_issue_comment_reaction(self, comment_id: str, reaction_id: str) -> None:
        """Delete a reaction on an issue comment."""
        return self._exec(lambda r, p: p.delete_issue_comment_reaction(r, comment_id, reaction_id))

    def get_pull_request_comment_reactions(self, comment_id: str) -> list[ReactionResult]:
        """Get reactions on a pull request comment."""
        return self._exec(lambda r, p: p.get_pull_request_comment_reactions(r, comment_id))

    def create_pull_request_comment_reaction(self, comment_id: str, reaction: Reaction) -> None:
        """Create a reaction on a pull request comment."""
        return self._exec(
            lambda r, p: p.create_pull_request_comment_reaction(r, comment_id, reaction)
        )

    def delete_pull_request_comment_reaction(self, comment_id: str, reaction_id: str) -> None:
        """Delete a reaction on a pull request comment."""
        return self._exec(
            lambda r, p: p.delete_pull_request_comment_reaction(r, comment_id, reaction_id)
        )

    def get_issue_reactions(self, issue_id: str) -> list[ReactionResult]:
        """Get reactions on an issue."""
        return self._exec(lambda r, p: p.get_issue_reactions(r, issue_id))

    def create_issue_reaction(self, issue_id: str, reaction: Reaction) -> None:
        """Create a reaction on an issue."""
        return self._exec(lambda r, p: p.create_issue_reaction(r, issue_id, reaction))

    def delete_issue_reaction(self, issue_id: str, reaction_id: Reaction) -> None:
        """Delete a reaction on an issue."""
        return self._exec(lambda r, p: p.delete_issue_reaction(r, issue_id, reaction_id))

    def get_pull_request_reactions(self, pull_request_id: str) -> list[ReactionResult]:
        """Get reactions on a pull request."""
        return self._exec(lambda r, p: p.get_pull_request_reactions(r, pull_request_id))

    def create_pull_request_reaction(self, pull_request_id: str, reaction: Reaction) -> None:
        """Create a reaction on a pull request."""
        return self._exec(lambda r, p: p.create_pull_request_reaction(r, pull_request_id, reaction))

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        """Delete a reaction on a pull request."""
        return self._exec(
            lambda r, p: p.delete_pull_request_reaction(r, pull_request_id, reaction_id)
        )

    # Branch operations

    def get_branch(self, branch: str) -> GitRefActionResult:
        """Get a branch reference."""
        return self._exec(lambda r, p: p.get_branch(r, branch))

    def create_branch(self, branch: str, sha: str) -> GitRefActionResult:
        """Create a new branch pointing at the given SHA."""
        return self._exec(lambda r, p: p.create_branch(r, branch, sha))

    def update_branch(self, branch: str, sha: str, force: bool = False) -> None:
        """Update a branch to point at a new SHA."""
        return self._exec(lambda r, p: p.update_branch(r, branch, sha, force))

    # Git blob operations

    def create_git_blob(self, content: str, encoding: str) -> GitBlobActionResult:
        """Create a git blob object."""
        return self._exec(lambda r, p: p.create_git_blob(r, content, encoding))

    # File content operations

    def get_file_content(self, path: str, ref: str | None = None) -> FileContentActionResult:
        return self._exec(lambda r, p: p.get_file_content(r, path, ref))

    # Commit operations

    def get_commit(self, sha: str) -> CommitActionResult:
        return self._exec(lambda r, p: p.get_commit(r, sha))

    def get_commits(
        self, *, sha: str | None = None, path: str | None = None
    ) -> list[CommitActionResult]:
        return self._exec(lambda r, p: p.get_commits(r, sha=sha, path=path))

    def compare_commits(self, start_sha: str, end_sha: str) -> CommitComparisonActionResult:
        return self._exec(lambda r, p: p.compare_commits(r, start_sha, end_sha))

    # Git data operations

    def get_tree(self, tree_sha: str, *, recursive: bool = True) -> GitTreeActionResult:
        return self._exec(lambda r, p: p.get_tree(r, tree_sha, recursive=recursive))

    def get_git_commit(self, sha: str) -> GitCommitObjectActionResult:
        return self._exec(lambda r, p: p.get_git_commit(r, sha))

    def create_git_tree(
        self, tree: list[InputTreeEntry], *, base_tree: str | None = None
    ) -> GitTreeActionResult:
        return self._exec(lambda r, p: p.create_git_tree(r, tree, base_tree=base_tree))

    def create_git_commit(
        self, message: str, tree_sha: str, parent_shas: list[str]
    ) -> GitCommitObjectActionResult:
        return self._exec(lambda r, p: p.create_git_commit(r, message, tree_sha, parent_shas))

    # Expanded pull request operations

    def get_pull_request_files(self, pull_request_id: str) -> PullRequestFileActionResult:
        return self._exec(lambda r, p: p.get_pull_request_files(r, pull_request_id))

    def get_pull_request_commits(self, pull_request_id: str) -> PullRequestCommitActionResult:
        return self._exec(lambda r, p: p.get_pull_request_commits(r, pull_request_id))

    def get_pull_request_diff(self, pull_request_id: str) -> PullRequestDiffActionResult:
        return self._exec(lambda r, p: p.get_pull_request_diff(r, pull_request_id))

    def list_pull_requests(
        self, state: str = "open", head: str | None = None
    ) -> list[PullRequestActionResult]:
        return self._exec(lambda r, p: p.list_pull_requests(r, state, head))

    def create_pull_request(
        self, title: str, body: str, head: str, base: str, *, draft: bool = False
    ) -> PullRequestActionResult:
        return self._exec(
            lambda r, p: p.create_pull_request(r, title, body, head, base, draft=draft)
        )

    def update_pull_request(
        self,
        pull_request_id: str,
        *,
        title: str | None = None,
        body: str | None = None,
        state: str | None = None,
    ) -> PullRequestActionResult:
        return self._exec(
            lambda r, p: p.update_pull_request(
                r, pull_request_id, title=title, body=body, state=state
            )
        )

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None:
        return self._exec(lambda r, p: p.request_review(r, pull_request_id, reviewers))

    # Review operations

    def create_review_comment(
        self,
        pull_request_id: str,
        body: str,
        commit_sha: str,
        path: str,
        *,
        line: int | None = None,
        side: str | None = None,
        start_line: int | None = None,
        start_side: str | None = None,
    ) -> ReviewCommentActionResult:
        return self._exec(
            lambda r, p: p.create_review_comment(
                r,
                pull_request_id,
                body,
                commit_sha,
                path,
                line=line,
                side=side,
                start_line=start_line,
                start_side=start_side,
            )
        )

    def create_review(
        self,
        pull_request_id: str,
        commit_sha: str,
        event: str,
        comments: list[ReviewCommentInput],
        *,
        body: str | None = None,
    ) -> ReviewActionResult:
        return self._exec(
            lambda r, p: p.create_review(r, pull_request_id, commit_sha, event, comments, body=body)
        )

    # Check run operations

    def create_check_run(
        self,
        name: str,
        head_sha: str,
        *,
        status: str | None = None,
        conclusion: str | None = None,
        external_id: str | None = None,
        started_at: str | None = None,
        completed_at: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> CheckRunActionResult:
        return self._exec(
            lambda r, p: p.create_check_run(
                r,
                name,
                head_sha,
                status=status,
                conclusion=conclusion,
                external_id=external_id,
                started_at=started_at,
                completed_at=completed_at,
                output=output,
            )
        )

    def get_check_run(self, check_run_id: str) -> CheckRunActionResult:
        return self._exec(lambda r, p: p.get_check_run(r, check_run_id))

    def update_check_run(
        self,
        check_run_id: str,
        *,
        status: str | None = None,
        conclusion: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> CheckRunActionResult:
        return self._exec(
            lambda r, p: p.update_check_run(
                r, check_run_id, status=status, conclusion=conclusion, output=output
            )
        )

    # GraphQL mutation operations

    def minimize_comment(self, comment_node_id: str, reason: str) -> None:
        return self._exec(lambda r, p: p.minimize_comment(r, comment_node_id, reason))

    def resolve_review_thread(self, thread_node_id: str) -> None:
        return self._exec(lambda r, p: p.resolve_review_thread(r, thread_node_id))
