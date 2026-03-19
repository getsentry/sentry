from collections.abc import Callable
from typing import Self

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMProviderNotSupported
from sentry.scm.private.facade import Facade
from sentry.scm.private.helpers import (
    exec_provider_fn,
    fetch_repository,
    fetch_service_provider,
    initialize_provider,
    map_integration_to_provider,
    map_repository_model_to_repository,
)
from sentry.scm.private.ipc import record_count_metric
from sentry.scm.private.provider import (
    GetIssueCommentsProtocol,
    CreateIssueCommentProtocol,
    DeleteIssueCommentProtocol,
    GetPullRequestCommentsProtocol,
    CreatePullRequestCommentProtocol,
    DeletePullRequestCommentProtocol,
    GetIssueCommentReactionsProtocol,
    CreateIssueCommentReactionProtocol,
    DeleteIssueCommentReactionProtocol,
    GetPullRequestCommentReactionsProtocol,
    CreatePullRequestCommentReactionProtocol,
    DeletePullRequestCommentReactionProtocol,
    GetIssueReactionsProtocol,
    CreateIssueReactionProtocol,
    DeleteIssueReactionProtocol,
    GetPullRequestReactionsProtocol,
    CreatePullRequestReactionProtocol,
    DeletePullRequestReactionProtocol,
    GetBranchProtocol,
    CreateBranchProtocol,
    UpdateBranchProtocol,
    GetCommitProtocol,
    GetCommitsProtocol,
    GetCommitsByPathProtocol,
    CompareCommitsProtocol,
    GetPullRequestProtocol,
    GetPullRequestsProtocol,
    GetPullRequestFilesProtocol,
    GetPullRequestCommitsProtocol,
    GetPullRequestDiffProtocol,
    CreatePullRequestProtocol,
    CreatePullRequestDraftProtocol,
    UpdatePullRequestProtocol,
    RequestReviewProtocol,
    GetTreeProtocol,
    GetGitCommitProtocol,
    CreateGitBlobProtocol,
    CreateGitTreeProtocol,
    CreateGitCommitProtocol,
    GetFileContentProtocol,
    GetCheckRunProtocol,
    CreateCheckRunProtocol,
    UpdateCheckRunProtocol,
    CreateReviewCommentFileProtocol,
    CreateReviewCommentLineProtocol,
    CreateReviewCommentMultilineProtocol,
    CreateReviewCommentReplyProtocol,
    CreateReviewProtocol,
    MinimizeCommentProtocol,
    ResolveReviewThreadProtocol,
    Provider,
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


class SourceCodeManager(Facade):
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


def get_issue_comments(
    scm,
    issue_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[Comment]:
    """Get comments on an issue."""
    return self._exec(
        lambda p: p.get_issue_comments(issue_id, pagination, request_options),
    )


def create_issue_comment(scm, issue_id: str, body: str) -> ActionResult[Comment]:
    """Create a comment on an issue."""
    return self._exec(
        lambda p: p.create_issue_comment(issue_id, body),
    )


def delete_issue_comment(scm, issue_id: str, comment_id: str) -> None:
    """Delete a comment on an issue."""
    return self._exec(
        lambda p: p.delete_issue_comment(issue_id, comment_id),
    )


def get_pull_request(
    scm,
    pull_request_id: str,
    request_options: RequestOptions | None = None,
) -> ActionResult[PullRequest]:
    """Get a pull request."""
    return self._exec(
        lambda p: p.get_pull_request(pull_request_id, request_options),
    )


def get_pull_request_comments(
    scm,
    pull_request_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[Comment]:
    """Get comments on a pull request."""
    return self._exec(
        lambda p: p.get_pull_request_comments(pull_request_id, pagination, request_options),
    )


def create_pull_request_comment(scm, pull_request_id: str, body: str) -> ActionResult[Comment]:
    """Create a comment on a pull request."""
    return self._exec(
        lambda p: p.create_pull_request_comment(pull_request_id, body),
    )


def delete_pull_request_comment(scm, pull_request_id: str, comment_id: str) -> None:
    """Delete a comment on a pull request."""
    return self._exec(
        lambda p: p.delete_pull_request_comment(pull_request_id, comment_id),
    )


def get_issue_comment_reactions(
    scm,
    issue_id: str,
    comment_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[ReactionResult]:
    """Get reactions on an issue comment."""
    return self._exec(
        lambda p: p.get_issue_comment_reactions(issue_id, comment_id, pagination, request_options),
    )


def create_issue_comment_reaction(
    scm, issue_id: str, comment_id: str, reaction: Reaction
) -> ActionResult[ReactionResult]:
    """Create a reaction on an issue comment."""
    return self._exec(
        lambda p: p.create_issue_comment_reaction(issue_id, comment_id, reaction),
    )


def delete_issue_comment_reaction(scm, issue_id: str, comment_id: str, reaction_id: str) -> None:
    """Delete a reaction on an issue comment."""
    return self._exec(
        lambda p: p.delete_issue_comment_reaction(issue_id, comment_id, reaction_id),
    )


def get_pull_request_comment_reactions(
    scm,
    pull_request_id: str,
    comment_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[ReactionResult]:
    """Get reactions on a pull request comment."""
    return self._exec(
        lambda p: p.get_pull_request_comment_reactions(
            pull_request_id, comment_id, pagination, request_options
        ),
    )


def create_pull_request_comment_reaction(
    scm, pull_request_id: str, comment_id: str, reaction: Reaction
) -> ActionResult[ReactionResult]:
    """Create a reaction on a pull request comment."""
    return self._exec(
        lambda p: p.create_pull_request_comment_reaction(pull_request_id, comment_id, reaction),
    )


def delete_pull_request_comment_reaction(
    scm, pull_request_id: str, comment_id: str, reaction_id: str
) -> None:
    """Delete a reaction on a pull request comment."""
    return self._exec(
        lambda p: p.delete_pull_request_comment_reaction(pull_request_id, comment_id, reaction_id),
    )


def get_issue_reactions(
    scm,
    issue_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[ReactionResult]:
    """Get reactions on an issue."""
    return self._exec(
        lambda p: p.get_issue_reactions(issue_id, pagination, request_options),
    )


def create_issue_reaction(scm, issue_id: str, reaction: Reaction) -> ActionResult[ReactionResult]:
    """Create a reaction on an issue."""
    return self._exec(
        lambda p: p.create_issue_reaction(issue_id, reaction),
    )


def delete_issue_reaction(scm, issue_id: str, reaction_id: str) -> None:
    """Delete a reaction on an issue."""
    return self._exec(
        lambda p: p.delete_issue_reaction(issue_id, reaction_id),
    )


def get_pull_request_reactions(
    scm,
    pull_request_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[ReactionResult]:
    """Get reactions on a pull request."""
    return self._exec(
        lambda p: p.get_pull_request_reactions(pull_request_id, pagination, request_options),
    )


def create_pull_request_reaction(
    scm, pull_request_id: str, reaction: Reaction
) -> ActionResult[ReactionResult]:
    """Create a reaction on a pull request."""
    return self._exec(
        lambda p: p.create_pull_request_reaction(pull_request_id, reaction),
    )


def delete_pull_request_reaction(scm, pull_request_id: str, reaction_id: str) -> None:
    """Delete a reaction on a pull request."""
    return self._exec(
        lambda p: p.delete_pull_request_reaction(pull_request_id, reaction_id),
    )


def get_branch(
    scm,
    branch: BranchName,
    request_options: RequestOptions | None = None,
) -> ActionResult[GitRef]:
    """Get a branch reference."""
    return self._exec(
        lambda p: p.get_branch(branch, request_options),
    )


def create_branch(scm, branch: BranchName, sha: SHA) -> ActionResult[GitRef]:
    """Create a new branch pointing at the given SHA."""
    return self._exec(
        lambda p: p.create_branch(branch, sha),
    )


def update_branch(scm, branch: BranchName, sha: SHA, force: bool = False) -> ActionResult[GitRef]:
    """Update a branch to point at a new SHA."""
    return self._exec(
        lambda p: p.update_branch(branch, sha, force),
    )


def create_git_blob(scm, content: str, encoding: str) -> ActionResult[GitBlob]:
    """Create a git blob object."""
    return self._exec(
        lambda p: p.create_git_blob(content, encoding),
    )


def get_file_content(
    scm,
    path: str,
    ref: str | None = None,
    request_options: RequestOptions | None = None,
) -> ActionResult[FileContent]:
    return self._exec(
        lambda p: p.get_file_content(path, ref, request_options),
    )


def get_commit(
    scm,
    sha: SHA,
    request_options: RequestOptions | None = None,
) -> ActionResult[Commit]:
    return self._exec(
        lambda p: p.get_commit(sha, request_options),
    )


def get_commits(
    scm,
    ref: str | None = None,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[Commit]:
    """
    Get a paginated list of commits.

    `ref` is either a branch name, a tag name, or a commit SHA.
    Specifying a commit SHA retrieves commits up to the given commit SHA.

    Commits are returned in descending order. Equivalent to `git log ref`.
    """
    return self._exec(
        lambda p: p.get_commits(ref=ref, pagination=pagination, request_options=request_options),
    )


def get_commits_by_path(
    scm,
    path: str,
    ref: str | None = None,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[Commit]:
    """
    Get a paginated list of commits for a given filepath.

    `ref` is either a branch name, a tag name, or a commit SHA.
    Specifying a commit SHA retrieves commits up to the given commit SHA.

    Commits are returned in descending order. Equivalent to `git log ref`.
    """
    return self._exec(
        lambda p: p.get_commits_by_path(
            path=path, ref=ref, pagination=pagination, request_options=request_options
        ),
    )


def compare_commits(
    scm,
    start_sha: SHA,
    end_sha: SHA,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[Commit]:
    return self._exec(
        lambda p: p.compare_commits(start_sha, end_sha, pagination, request_options),
    )


def get_tree(
    scm,
    tree_sha: SHA,
    recursive: bool = True,
    request_options: RequestOptions | None = None,
) -> ActionResult[GitTree]:
    return self._exec(
        lambda p: p.get_tree(tree_sha, recursive=recursive, request_options=request_options),
    )


def get_git_commit(
    scm,
    sha: SHA,
    request_options: RequestOptions | None = None,
) -> ActionResult[GitCommitObject]:
    return self._exec(
        lambda p: p.get_git_commit(sha, request_options),
    )


def create_git_tree(
    scm,
    tree: list[InputTreeEntry],
    base_tree: SHA | None = None,
) -> ActionResult[GitTree]:
    return self._exec(
        lambda p: p.create_git_tree(tree, base_tree=base_tree),
    )


def create_git_commit(
    scm, message: str, tree_sha: SHA, parent_shas: list[SHA]
) -> ActionResult[GitCommitObject]:
    return self._exec(
        lambda p: p.create_git_commit(message, tree_sha, parent_shas),
    )


def get_pull_request_files(
    scm,
    pull_request_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[PullRequestFile]:
    return self._exec(
        lambda p: p.get_pull_request_files(pull_request_id, pagination, request_options),
    )


def get_pull_request_commits(
    scm,
    pull_request_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[PullRequestCommit]:
    return self._exec(
        lambda p: p.get_pull_request_commits(pull_request_id, pagination, request_options),
    )


def get_pull_request_diff(
    scm,
    pull_request_id: str,
    request_options: RequestOptions | None = None,
) -> ActionResult[str]:
    return self._exec(
        lambda p: p.get_pull_request_diff(pull_request_id, request_options),
    )


def get_pull_requests(
    scm,
    state: PullRequestState | None = "open",
    head: BranchName | None = None,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[PullRequest]:
    return self._exec(
        lambda p: p.get_pull_requests(state, head, pagination, request_options),
    )


def create_pull_request(
    scm,
    title: str,
    body: str,
    head: BranchName,
    base: BranchName,
) -> ActionResult[PullRequest]:
    return self._exec(
        lambda p: p.create_pull_request(title, body, head, base),
    )


def create_pull_request_draft(
    scm,
    title: str,
    body: str,
    head: BranchName,
    base: BranchName,
) -> ActionResult[PullRequest]:
    return self._exec(
        lambda p: p.create_pull_request_draft(title, body, head, base),
    )


def update_pull_request(
    scm,
    pull_request_id: str,
    title: str | None = None,
    body: str | None = None,
    state: PullRequestState | None = None,
) -> ActionResult[PullRequest]:
    return self._exec(
        lambda p: p.update_pull_request(pull_request_id, title=title, body=body, state=state),
    )


def request_review(scm, pull_request_id: str, reviewers: list[str]) -> None:
    return self._exec(
        lambda p: p.request_review(pull_request_id, reviewers),
    )


def create_review_comment_file(
    scm,
    pull_request_id: str,
    commit_id: SHA,
    body: str,
    path: str,
    side: ReviewSide,
) -> ActionResult[ReviewComment]:
    """Leave a review comment on a file."""
    return self._exec(
        lambda p: p.create_review_comment_file(pull_request_id, commit_id, body, path, side),
    )


def create_review_comment_reply(
    scm,
    pull_request_id: str,
    body: str,
    comment_id: str,
) -> ActionResult[ReviewComment]:
    """Leave a review comment in reply to another review comment."""
    return self._exec(
        lambda p: p.create_review_comment_reply(pull_request_id, body, comment_id),
    )


def create_review(
    scm: CreateReviewProtocol,
    pull_request_id: str,
    commit_sha: SHA,
    event: ReviewEvent,
    comments: list[ReviewCommentInput],
    body: str | None = None,
) -> ActionResult[Review]:
    return scm.create_review(pull_request_id, commit_sha, event, comments, body=body)


def create_check_run(
    scm: CreateCheckRunProtocol,
    name: str,
    head_sha: SHA,
    status: BuildStatus | None = None,
    conclusion: BuildConclusion | None = None,
    external_id: str | None = None,
    started_at: str | None = None,
    completed_at: str | None = None,
    output: CheckRunOutput | None = None,
) -> ActionResult[CheckRun]:
    return scm.create_check_run(
        name,
        head_sha,
        status=status,
        conclusion=conclusion,
        external_id=external_id,
        started_at=started_at,
        completed_at=completed_at,
        output=output
    )


def get_check_run(
    scm: GetCheckRunProtocol,
    check_run_id: ResourceId,
    request_options: RequestOptions | None = None,
) -> ActionResult[CheckRun]:
    return scm.get_check_run(check_run_id, request_options)


def update_check_run(
    scm: UpdateCheckRunProtocol,
    check_run_id: ResourceId,
    status: BuildStatus | None = None,
    conclusion: BuildConclusion | None = None,
    output: CheckRunOutput | None = None,
) -> ActionResult[CheckRun]:
    return scm.update_check_run(check_run_id, status=status, conclusion=conclusion, output=output)


def minimize_comment(scm: MinimizeCommentProtocol, comment_node_id: str, reason: str) -> None:
    return scm.minimize_comment(comment_node_id, reason)
