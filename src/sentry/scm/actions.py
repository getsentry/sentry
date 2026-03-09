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
    Provider,
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
        organization_id: int,
        repository_id: RepositoryId,
        *,
        referrer: Referrer = "shared",
        fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
        fetch_service_provider: Callable[[int, Repository], Provider] = fetch_service_provider,
    ):
        """
        The SourceCodeManager class manages ACLs, rate-limits, environment setup, and a
        vendor-agnostic mapping of actions to service-provider commands. The SourceCodeManager
        exposes a declarative interface. Developers declare what they want and the concrete
        implementation details of what's done are abstracted.

        The SourceCodeManager _will_ throw exceptions. That is its intended operating mode. In your
        application code you are expected to catch the base SCMError type.

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
        :type fetch_service_provider: Callable[[int, Repository], Provider]
        """
        self.organization_id = organization_id
        self.repository_id = repository_id
        self.referrer = referrer
        self.fetch_repository = fetch_repository
        self.fetch_service_provider: Callable[[int, Repository], Provider] = fetch_service_provider

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
        provider = map_integration_to_provider(organization_id, integration, repository_)

        return cls(
            organization_id,
            repository.id,
            referrer=referrer,
            fetch_repository=lambda _, __: repository_,
            fetch_service_provider=lambda _, __: provider,
        )

    def _exec[T](self, provider_fn: Callable[[Provider], T]) -> T:
        return exec_provider_fn(
            self.organization_id,
            self.repository_id,
            referrer=self.referrer,
            fetch_repository=self.fetch_repository,
            fetch_service_provider=self.fetch_service_provider,
            provider_fn=provider_fn,
        )

    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        """Get comments on an issue."""
        return self._exec(lambda p: p.get_issue_comments(issue_id, pagination, request_options))

    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]:
        """Create a comment on an issue."""
        return self._exec(lambda p: p.create_issue_comment(issue_id, body))

    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None:
        """Delete a comment on an issue."""
        return self._exec(lambda p: p.delete_issue_comment(issue_id, comment_id))

    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]:
        """Get a pull request."""
        return self._exec(lambda p: p.get_pull_request(pull_request_id, request_options))

    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        """Get comments on a pull request."""
        return self._exec(
            lambda p: p.get_pull_request_comments(pull_request_id, pagination, request_options)
        )

    def create_pull_request_comment(self, pull_request_id: str, body: str) -> ActionResult[Comment]:
        """Create a comment on a pull request."""
        return self._exec(lambda p: p.create_pull_request_comment(pull_request_id, body))

    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None:
        """Delete a comment on a pull request."""
        return self._exec(lambda p: p.delete_pull_request_comment(pull_request_id, comment_id))

    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on an issue comment."""
        return self._exec(
            lambda p: p.get_issue_comment_reactions(
                issue_id, comment_id, pagination, request_options
            )
        )

    def create_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on an issue comment."""
        return self._exec(lambda p: p.create_issue_comment_reaction(issue_id, comment_id, reaction))

    def delete_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction_id: str
    ) -> None:
        """Delete a reaction on an issue comment."""
        return self._exec(
            lambda p: p.delete_issue_comment_reaction(issue_id, comment_id, reaction_id)
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
            lambda p: p.get_pull_request_comment_reactions(
                pull_request_id, comment_id, pagination, request_options
            )
        )

    def create_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on a pull request comment."""
        return self._exec(
            lambda p: p.create_pull_request_comment_reaction(pull_request_id, comment_id, reaction)
        )

    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None:
        """Delete a reaction on a pull request comment."""
        return self._exec(
            lambda p: p.delete_pull_request_comment_reaction(
                pull_request_id, comment_id, reaction_id
            )
        )

    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on an issue."""
        return self._exec(lambda p: p.get_issue_reactions(issue_id, pagination, request_options))

    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on an issue."""
        return self._exec(lambda p: p.create_issue_reaction(issue_id, reaction))

    def delete_issue_reaction(self, issue_id: str, reaction_id: Reaction) -> None:
        """Delete a reaction on an issue."""
        return self._exec(lambda p: p.delete_issue_reaction(issue_id, reaction_id))

    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on a pull request."""
        return self._exec(
            lambda p: p.get_pull_request_reactions(pull_request_id, pagination, request_options)
        )

    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on a pull request."""
        return self._exec(lambda p: p.create_pull_request_reaction(pull_request_id, reaction))

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        """Delete a reaction on a pull request."""
        return self._exec(lambda p: p.delete_pull_request_reaction(pull_request_id, reaction_id))

    def get_branch(
        self,
        branch: BranchName,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]:
        """Get a branch reference."""
        return self._exec(lambda p: p.get_branch(branch, request_options))

    def create_branch(self, branch: BranchName, sha: SHA) -> ActionResult[GitRef]:
        """Create a new branch pointing at the given SHA."""
        return self._exec(lambda p: p.create_branch(branch, sha))

    def update_branch(
        self, branch: BranchName, sha: SHA, force: bool = False
    ) -> ActionResult[GitRef]:
        """Update a branch to point at a new SHA."""
        return self._exec(lambda p: p.update_branch(branch, sha, force))

    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]:
        """Create a git blob object."""
        return self._exec(lambda p: p.create_git_blob(content, encoding))

    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]:
        return self._exec(lambda p: p.get_file_content(path, ref, request_options))

    def get_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]:
        return self._exec(lambda p: p.get_commit(sha, request_options))

    def get_commits(
        self,
        sha: SHA | None = None,
        path: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        return self._exec(
            lambda p: p.get_commits(
                sha=sha, path=path, pagination=pagination, request_options=request_options
            )
        )

    def compare_commits(
        self,
        start_sha: SHA,
        end_sha: SHA,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        return self._exec(
            lambda p: p.compare_commits(start_sha, end_sha, pagination, request_options)
        )

    def get_tree(
        self,
        tree_sha: SHA,
        recursive: bool = True,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitTree]:
        return self._exec(
            lambda p: p.get_tree(tree_sha, recursive=recursive, request_options=request_options)
        )

    def get_git_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitCommitObject]:
        return self._exec(lambda p: p.get_git_commit(sha, request_options))

    def create_git_tree(
        self,
        tree: list[InputTreeEntry],
        base_tree: SHA | None = None,
    ) -> ActionResult[GitTree]:
        return self._exec(lambda p: p.create_git_tree(tree, base_tree=base_tree))

    def create_git_commit(
        self, message: str, tree_sha: SHA, parent_shas: list[SHA]
    ) -> ActionResult[GitCommitObject]:
        return self._exec(lambda p: p.create_git_commit(message, tree_sha, parent_shas))

    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]:
        return self._exec(
            lambda p: p.get_pull_request_files(pull_request_id, pagination, request_options)
        )

    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]:
        return self._exec(
            lambda p: p.get_pull_request_commits(pull_request_id, pagination, request_options)
        )

    def get_pull_request_diff(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[str]:
        return self._exec(lambda p: p.get_pull_request_diff(pull_request_id, request_options))

    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        head: BranchName | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]:
        return self._exec(lambda p: p.get_pull_requests(state, head, pagination, request_options))

    def create_pull_request(
        self,
        title: str,
        body: str,
        head: BranchName,
        base: BranchName,
        draft: bool = False,
    ) -> ActionResult[PullRequest]:
        return self._exec(lambda p: p.create_pull_request(title, body, head, base, draft=draft))

    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: PullRequestState | None = None,
    ) -> ActionResult[PullRequest]:
        return self._exec(
            lambda p: p.update_pull_request(pull_request_id, title=title, body=body, state=state)
        )

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None:
        return self._exec(lambda p: p.request_review(pull_request_id, reviewers))

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
            lambda p: p.create_review_comment_file(pull_request_id, commit_id, body, path, side)
        )

    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment in reply to another review comment."""
        return self._exec(
            lambda p: p.create_review_comment_reply(pull_request_id, body, comment_id)
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
            lambda p: p.create_review(pull_request_id, commit_sha, event, comments, body=body)
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
            lambda p: p.create_check_run(
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

    def get_check_run(
        self,
        check_run_id: ResourceId,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[CheckRun]:
        return self._exec(lambda p: p.get_check_run(check_run_id, request_options))

    def update_check_run(
        self,
        check_run_id: ResourceId,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        return self._exec(
            lambda p: p.update_check_run(
                check_run_id, status=status, conclusion=conclusion, output=output
            )
        )

    def minimize_comment(self, comment_node_id: str, reason: str) -> None:
        return self._exec(lambda p: p.minimize_comment(comment_node_id, reason))
