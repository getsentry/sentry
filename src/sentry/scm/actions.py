from collections.abc import Callable
from typing import Self

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMProviderNotSupported
from sentry.scm.private.helpers import (
    exec_provider_fn,
    fetch_repository,
    fetch_service_provider,
    initialize_provider,
    map_integration_to_provider,
    map_repository_model_to_repository,
)
from sentry.scm.private.ipc import record_count_metric
from sentry.scm.private.provider import ActionMap, Provider
from sentry.scm.types import (
    SHA,
    ActionResult,
    BranchName,
    BuildConclusion,
    BuildStatus,
    CheckRun,
    CheckRunOutput,
    Comment,
    Commit,
    FileContent,
    GitBlob,
    GitCommitObject,
    GitRef,
    GitTree,
    InputTreeEntry,
    PaginatedActionResult,
    PaginationParams,
    PullRequest,
    PullRequestCommit,
    PullRequestFile,
    PullRequestState,
    Reaction,
    ReactionResult,
    Referrer,
    Repository,
    RepositoryId,
    RequestOptions,
    ResourceId,
    Review,
    ReviewComment,
    ReviewCommentInput,
    ReviewEvent,
    ReviewSide,
)


class SourceCodeManager:
    def __init__(
        self,
        provider: Provider,
        *,
        referrer: Referrer = "shared",
        record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    ):
        """
        The SourceCodeManager class manages ACLs, rate-limits, environment setup, and a
        vendor-agnostic mapping of actions to service-provider commands. The SourceCodeManager
        exposes a declarative interface. Developers declare what they want and the concrete
        implementation details of what's done are abstracted.

        The SourceCodeManager _will_ throw exceptions. That is its intended operating mode. In your
        application code you are expected to catch the base SCMError type.
        """
        self.provider = provider
        self.referrer = referrer
        self.record_count = record_count

    @classmethod
    def make_from_repository_id(
        cls,
        organization_id: int,
        repository_id: RepositoryId,
        *,
        referrer: Referrer = "shared",
        fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
        fetch_service_provider: Callable[
            [int, Repository], Provider | None
        ] = fetch_service_provider,
        record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    ) -> Self:
        provider = initialize_provider(
            organization_id,
            repository_id,
            fetch_repository=fetch_repository,
            fetch_service_provider=fetch_service_provider,
        )
        return cls(provider, referrer=referrer, record_count=record_count)

    @classmethod
    def make_from_integration(
        cls,
        organization_id: int,
        repository: RepositoryModel,
        integration: Integration | RpcIntegration,
        *,
        referrer: Referrer = "shared",
        record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    ) -> Self:
        provider = initialize_provider(
            organization_id,
            repository.id,
            fetch_repository=lambda _, __: map_repository_model_to_repository(repository),
            fetch_service_provider=lambda oid, repo: map_integration_to_provider(
                oid, integration, repo
            ),
        )

        return cls(provider, referrer=referrer, record_count=record_count)

    def _exec[P, T](self, protocol: type[P], provider_fn: Callable[[P], T]) -> T:
        provider = self.provider
        if not isinstance(provider, protocol):
            raise SCMProviderNotSupported("Action not supported.")

        return exec_provider_fn(
            self.provider,
            referrer=self.referrer,
            provider_fn=lambda: provider_fn(provider),
            record_count=self.record_count,
        )

    def can(self, actions: list[str]) -> bool:
        """
        Returns true if the SourceCodeManager can execute a set of actions against a target API.

        Interactions with source code management services are not transactional. There are many
        failure points in the process and partial states are a reality that must be handled. One
        common failure mode is a mismatch of expectations between what the SCM supports and what a
        SCM provider can actually accommodate. By asking up front, "can the provider for this
        customer accommodate all the actions I need to execute?" a developer can eagerly exit or
        alter some behavior when we know the request will fail deterministically. This eliminates
        the need to clean-up side-effects after a partially implemented SCM provider fails.
        """
        return all(
            hasattr(ActionMap, action) and isinstance(self.provider, getattr(ActionMap, action))
            for action in actions
        )

    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        """Get comments on an issue."""
        return self._exec(
            ActionMap.get_issue_comments,  # type: ignore[type-abstract]
            lambda p: p.get_issue_comments(issue_id, pagination, request_options),
        )

    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]:
        """Create a comment on an issue."""
        return self._exec(
            ActionMap.create_issue_comment,  # type: ignore[type-abstract]
            lambda p: p.create_issue_comment(issue_id, body),
        )

    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None:
        """Delete a comment on an issue."""
        return self._exec(
            ActionMap.delete_issue_comment,  # type: ignore[type-abstract]
            lambda p: p.delete_issue_comment(issue_id, comment_id),
        )

    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]:
        """Get a pull request."""
        return self._exec(
            ActionMap.get_pull_request,  # type: ignore[type-abstract]
            lambda p: p.get_pull_request(pull_request_id, request_options),
        )

    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        """Get comments on a pull request."""
        return self._exec(
            ActionMap.get_pull_request_comments,  # type: ignore[type-abstract]
            lambda p: p.get_pull_request_comments(pull_request_id, pagination, request_options),
        )

    def create_pull_request_comment(self, pull_request_id: str, body: str) -> ActionResult[Comment]:
        """Create a comment on a pull request."""
        return self._exec(
            ActionMap.create_pull_request_comment,  # type: ignore[type-abstract]
            lambda p: p.create_pull_request_comment(pull_request_id, body),
        )

    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None:
        """Delete a comment on a pull request."""
        return self._exec(
            ActionMap.delete_pull_request_comment,  # type: ignore[type-abstract]
            lambda p: p.delete_pull_request_comment(pull_request_id, comment_id),
        )

    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on an issue comment."""
        return self._exec(
            ActionMap.get_issue_comment_reactions,  # type: ignore[type-abstract]
            lambda p: p.get_issue_comment_reactions(
                issue_id, comment_id, pagination, request_options
            ),
        )

    def create_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on an issue comment."""
        return self._exec(
            ActionMap.create_issue_comment_reaction,  # type: ignore[type-abstract]
            lambda p: p.create_issue_comment_reaction(issue_id, comment_id, reaction),
        )

    def delete_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction_id: str
    ) -> None:
        """Delete a reaction on an issue comment."""
        return self._exec(
            ActionMap.delete_issue_comment_reaction,  # type: ignore[type-abstract]
            lambda p: p.delete_issue_comment_reaction(issue_id, comment_id, reaction_id),
        )

    def get_pull_request_comment_reactions(
        self,
        pull_request_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on a pull request comment."""
        return self._exec(
            ActionMap.get_pull_request_comment_reactions,  # type: ignore[type-abstract]
            lambda p: p.get_pull_request_comment_reactions(
                pull_request_id, comment_id, pagination, request_options
            ),
        )

    def create_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on a pull request comment."""
        return self._exec(
            ActionMap.create_pull_request_comment_reaction,  # type: ignore[type-abstract]
            lambda p: p.create_pull_request_comment_reaction(pull_request_id, comment_id, reaction),
        )

    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None:
        """Delete a reaction on a pull request comment."""
        return self._exec(
            ActionMap.delete_pull_request_comment_reaction,  # type: ignore[type-abstract]
            lambda p: p.delete_pull_request_comment_reaction(
                pull_request_id, comment_id, reaction_id
            ),
        )

    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on an issue."""
        return self._exec(
            ActionMap.get_issue_reactions,  # type: ignore[type-abstract]
            lambda p: p.get_issue_reactions(issue_id, pagination, request_options),
        )

    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on an issue."""
        return self._exec(
            ActionMap.create_issue_reaction,  # type: ignore[type-abstract]
            lambda p: p.create_issue_reaction(issue_id, reaction),
        )

    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None:
        """Delete a reaction on an issue."""
        return self._exec(
            ActionMap.delete_issue_reaction,  # type: ignore[type-abstract]
            lambda p: p.delete_issue_reaction(issue_id, reaction_id),
        )

    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on a pull request."""
        return self._exec(
            ActionMap.get_pull_request_reactions,  # type: ignore[type-abstract]
            lambda p: p.get_pull_request_reactions(pull_request_id, pagination, request_options),
        )

    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on a pull request."""
        return self._exec(
            ActionMap.create_pull_request_reaction,  # type: ignore[type-abstract]
            lambda p: p.create_pull_request_reaction(pull_request_id, reaction),
        )

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        """Delete a reaction on a pull request."""
        return self._exec(
            ActionMap.delete_pull_request_reaction,  # type: ignore[type-abstract]
            lambda p: p.delete_pull_request_reaction(pull_request_id, reaction_id),
        )

    def get_branch(
        self,
        branch: BranchName,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]:
        """Get a branch reference."""
        return self._exec(
            ActionMap.get_branch,  # type: ignore[type-abstract]
            lambda p: p.get_branch(branch, request_options),
        )

    def create_branch(self, branch: BranchName, sha: SHA) -> ActionResult[GitRef]:
        """Create a new branch pointing at the given SHA."""
        return self._exec(
            ActionMap.create_branch,  # type: ignore[type-abstract]
            lambda p: p.create_branch(branch, sha),
        )

    def update_branch(
        self, branch: BranchName, sha: SHA, force: bool = False
    ) -> ActionResult[GitRef]:
        """Update a branch to point at a new SHA."""
        return self._exec(
            ActionMap.update_branch,  # type: ignore[type-abstract]
            lambda p: p.update_branch(branch, sha, force),
        )

    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]:
        """Create a git blob object."""
        return self._exec(
            ActionMap.create_git_blob,  # type: ignore[type-abstract]
            lambda p: p.create_git_blob(content, encoding),
        )

    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]:
        return self._exec(
            ActionMap.get_file_content,  # type: ignore[type-abstract]
            lambda p: p.get_file_content(path, ref, request_options),
        )

    def get_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]:
        return self._exec(
            ActionMap.get_commit,  # type: ignore[type-abstract]
            lambda p: p.get_commit(sha, request_options),
        )

    def get_commits(
        self,
        ref: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        """
        Get a paginated list of commits.

        `ref` is either a branch name, a tag name, or a commit SHA. Specifying a commit SHA
        retrieves commits up to the given commit SHA.

        Commits are returned in descending order. Equivalent to `git log ref`.
        """
        return self._exec(
            ActionMap.get_commits,  # type: ignore[type-abstract]
            lambda p: p.get_commits(
                ref=ref, pagination=pagination, request_options=request_options
            ),
        )

    def get_commits_by_path(
        self,
        path: str,
        ref: SHA | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        """
        Get a paginated list of commits for a given filepath.

        `ref` is either a branch name, a tag name, or a commit SHA. Specifying a commit SHA
        retrieves commits up to the given commit SHA.

        Commits are returned in descending order. Equivalent to `git log ref`.
        """
        return self._exec(
            ActionMap.get_commits_by_path,  # type: ignore[type-abstract]
            lambda p: p.get_commits_by_path(
                path=path, ref=ref, pagination=pagination, request_options=request_options
            ),
        )

    def compare_commits(
        self,
        start_sha: SHA,
        end_sha: SHA,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        return self._exec(
            ActionMap.compare_commits,  # type: ignore[type-abstract]
            lambda p: p.compare_commits(start_sha, end_sha, pagination, request_options),
        )

    def get_tree(
        self,
        tree_sha: SHA,
        recursive: bool = True,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitTree]:
        return self._exec(
            ActionMap.get_tree,  # type: ignore[type-abstract]
            lambda p: p.get_tree(tree_sha, recursive=recursive, request_options=request_options),
        )

    def get_git_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitCommitObject]:
        return self._exec(
            ActionMap.get_git_commit,  # type: ignore[type-abstract]
            lambda p: p.get_git_commit(sha, request_options),
        )

    def create_git_tree(
        self,
        tree: list[InputTreeEntry],
        base_tree: SHA | None = None,
    ) -> ActionResult[GitTree]:
        return self._exec(
            ActionMap.create_git_tree,  # type: ignore[type-abstract]
            lambda p: p.create_git_tree(tree, base_tree=base_tree),
        )

    def create_git_commit(
        self, message: str, tree_sha: SHA, parent_shas: list[SHA]
    ) -> ActionResult[GitCommitObject]:
        return self._exec(
            ActionMap.create_git_commit,  # type: ignore[type-abstract]
            lambda p: p.create_git_commit(message, tree_sha, parent_shas),
        )

    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]:
        return self._exec(
            ActionMap.get_pull_request_files,  # type: ignore[type-abstract]
            lambda p: p.get_pull_request_files(pull_request_id, pagination, request_options),
        )

    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]:
        return self._exec(
            ActionMap.get_pull_request_commits,  # type: ignore[type-abstract]
            lambda p: p.get_pull_request_commits(pull_request_id, pagination, request_options),
        )

    def get_pull_request_diff(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[str]:
        return self._exec(
            ActionMap.get_pull_request_diff,  # type: ignore[type-abstract]
            lambda p: p.get_pull_request_diff(pull_request_id, request_options),
        )

    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        head: BranchName | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]:
        return self._exec(
            ActionMap.get_pull_requests,  # type: ignore[type-abstract]
            lambda p: p.get_pull_requests(state, head, pagination, request_options),
        )

    def create_pull_request(
        self,
        title: str,
        body: str,
        head: BranchName,
        base: BranchName,
    ) -> ActionResult[PullRequest]:
        return self._exec(
            ActionMap.create_pull_request,  # type: ignore[type-abstract]
            lambda p: p.create_pull_request(title, body, head, base),
        )

    def create_pull_request_draft(
        self,
        title: str,
        body: str,
        head: BranchName,
        base: BranchName,
    ) -> ActionResult[PullRequest]:
        return self._exec(
            ActionMap.create_pull_request_draft,  # type: ignore[type-abstract]
            lambda p: p.create_pull_request_draft(title, body, head, base),
        )

    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: PullRequestState | None = None,
    ) -> ActionResult[PullRequest]:
        return self._exec(
            ActionMap.update_pull_request,  # type: ignore[type-abstract]
            lambda p: p.update_pull_request(pull_request_id, title=title, body=body, state=state),
        )

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None:
        return self._exec(
            ActionMap.request_review,  # type: ignore[type-abstract]
            lambda p: p.request_review(pull_request_id, reviewers),
        )

    def create_review_comment_file(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment on a file."""
        return self._exec(
            ActionMap.create_review_comment_file,  # type: ignore[type-abstract]
            lambda p: p.create_review_comment_file(pull_request_id, commit_id, body, path, side),
        )

    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment in reply to another review comment."""
        return self._exec(
            ActionMap.create_review_comment_reply,  # type: ignore[type-abstract]
            lambda p: p.create_review_comment_reply(pull_request_id, body, comment_id),
        )

    def create_review(
        self,
        pull_request_id: str,
        commit_sha: SHA,
        event: ReviewEvent,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ActionResult[Review]:
        return self._exec(
            ActionMap.create_review,  # type: ignore[type-abstract]
            lambda p: p.create_review(pull_request_id, commit_sha, event, comments, body=body),
        )

    def create_check_run(
        self,
        name: str,
        head_sha: SHA,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        external_id: str | None = None,
        started_at: str | None = None,
        completed_at: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        return self._exec(
            ActionMap.create_check_run,  # type: ignore[type-abstract]
            lambda p: p.create_check_run(
                name,
                head_sha,
                status=status,
                conclusion=conclusion,
                external_id=external_id,
                started_at=started_at,
                completed_at=completed_at,
                output=output,
            ),
        )

    def get_check_run(
        self,
        check_run_id: ResourceId,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[CheckRun]:
        return self._exec(
            ActionMap.get_check_run,  # type: ignore[type-abstract]
            lambda p: p.get_check_run(check_run_id, request_options),
        )

    def update_check_run(
        self,
        check_run_id: ResourceId,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        return self._exec(
            ActionMap.update_check_run,  # type: ignore[type-abstract]
            lambda p: p.update_check_run(
                check_run_id, status=status, conclusion=conclusion, output=output
            ),
        )

    def minimize_comment(self, comment_node_id: str, reason: str) -> None:
        return self._exec(
            ActionMap.minimize_comment,  # type: ignore[type-abstract]
            lambda p: p.minimize_comment(comment_node_id, reason),
        )
