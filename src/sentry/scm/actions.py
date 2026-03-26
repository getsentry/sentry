from collections.abc import Callable
from typing import Iterable, Self

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.private.facade import Facade
from sentry.scm.private.helpers import (
    fetch_repository,
    fetch_service_provider,
    initialize_provider,
    map_integration_to_provider,
    map_repository_model_to_repository,
)
from sentry.scm.private.ipc import record_count_metric
from sentry.scm.private.provider import (
    ALL_PROTOCOLS,
    CompareCommitsProtocol,
    CreateBranchProtocol,
    CreateCheckRunProtocol,
    CreateGitBlobProtocol,
    CreateGitCommitProtocol,
    CreateGitTreeProtocol,
    CreateIssueCommentProtocol,
    CreateIssueCommentReactionProtocol,
    CreateIssueReactionProtocol,
    CreatePullRequestCommentProtocol,
    CreatePullRequestCommentReactionProtocol,
    CreatePullRequestDraftProtocol,
    CreatePullRequestProtocol,
    CreatePullRequestReactionProtocol,
    CreateReviewCommentFileProtocol,
    CreateReviewCommentReplyProtocol,
    CreateReviewProtocol,
    DeleteIssueCommentProtocol,
    DeleteIssueCommentReactionProtocol,
    DeleteIssueReactionProtocol,
    DeletePullRequestCommentProtocol,
    DeletePullRequestCommentReactionProtocol,
    DeletePullRequestReactionProtocol,
    GetArchiveLinkProtocol,
    GetBranchProtocol,
    GetCheckRunProtocol,
    GetCommitProtocol,
    GetCommitsByPathProtocol,
    GetCommitsProtocol,
    GetFileContentProtocol,
    GetGitCommitProtocol,
    GetIssueCommentReactionsProtocol,
    GetIssueCommentsProtocol,
    GetIssueReactionsProtocol,
    GetPullRequestCommentReactionsProtocol,
    GetPullRequestCommentsProtocol,
    GetPullRequestCommitsProtocol,
    GetPullRequestDiffProtocol,
    GetPullRequestFilesProtocol,
    GetPullRequestProtocol,
    GetPullRequestReactionsProtocol,
    GetPullRequestsProtocol,
    GetTreeProtocol,
    MinimizeCommentProtocol,
    Provider,
    RequestReviewProtocol,
    UpdateBranchProtocol,
    UpdateCheckRunProtocol,
    UpdatePullRequestProtocol,
)
from sentry.scm.private.rate_limit import RateLimitProvider
from sentry.scm.types import (
    SHA,
    ActionResult,
    ArchiveFormat,
    ArchiveLink,
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
    """
    The SourceCodeManager class manages ACLs, rate-limits, environment setup, and a
    vendor-agnostic mapping of actions to service-provider commands. The SourceCodeManager
    exposes a declarative interface. Developers declare what they want and the concrete
    implementation details of what's done are abstracted.

    The SourceCodeManager _will_ throw exceptions. That is its intended operating mode. In your
    application code you are expected to catch the base SCMError type.
    """

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
        rate_limit_provider: RateLimitProvider | None = None,
        record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    ) -> Self:
        provider = initialize_provider(
            organization_id,
            repository.id,
            fetch_repository=lambda _, __: map_repository_model_to_repository(repository),
            fetch_service_provider=lambda oid, repo: map_integration_to_provider(
                oid, integration, repo, rate_limit_provider=rate_limit_provider
            ),
        )

        return cls(provider, referrer=referrer, record_count=record_count)


def get_capabilities(scm: SourceCodeManager) -> Iterable[str]:
    """Get the names of the protocols implemented by the given SourceCodeManager."""
    for protocol in ALL_PROTOCOLS:
        if isinstance(scm, protocol):
            yield protocol.__name__


def get_issue_comments(
    scm: GetIssueCommentsProtocol,
    issue_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[Comment]:
    """Get comments on an issue."""
    return scm.get_issue_comments(issue_id, pagination, request_options)


def create_issue_comment(
    scm: CreateIssueCommentProtocol, issue_id: str, body: str
) -> ActionResult[Comment]:
    """Create a comment on an issue."""
    return scm.create_issue_comment(issue_id, body)


def delete_issue_comment(scm: DeleteIssueCommentProtocol, issue_id: str, comment_id: str) -> None:
    """Delete a comment on an issue."""
    return scm.delete_issue_comment(issue_id, comment_id)


def get_pull_request(
    scm: GetPullRequestProtocol,
    pull_request_id: str,
    request_options: RequestOptions | None = None,
) -> ActionResult[PullRequest]:
    """Get a pull request."""
    return scm.get_pull_request(pull_request_id, request_options)


def get_pull_request_comments(
    scm: GetPullRequestCommentsProtocol,
    pull_request_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[Comment]:
    """Get comments on a pull request."""
    return scm.get_pull_request_comments(pull_request_id, pagination, request_options)


def create_pull_request_comment(
    scm: CreatePullRequestCommentProtocol, pull_request_id: str, body: str
) -> ActionResult[Comment]:
    """Create a comment on a pull request."""
    return scm.create_pull_request_comment(pull_request_id, body)


def delete_pull_request_comment(
    scm: DeletePullRequestCommentProtocol, pull_request_id: str, comment_id: str
) -> None:
    """Delete a comment on a pull request."""
    return scm.delete_pull_request_comment(pull_request_id, comment_id)


def get_issue_comment_reactions(
    scm: GetIssueCommentReactionsProtocol,
    issue_id: str,
    comment_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[ReactionResult]:
    """Get reactions on an issue comment."""
    return scm.get_issue_comment_reactions(issue_id, comment_id, pagination, request_options)


def create_issue_comment_reaction(
    scm: CreateIssueCommentReactionProtocol, issue_id: str, comment_id: str, reaction: Reaction
) -> ActionResult[ReactionResult]:
    """Create a reaction on an issue comment."""
    return scm.create_issue_comment_reaction(issue_id, comment_id, reaction)


def delete_issue_comment_reaction(
    scm: DeleteIssueCommentReactionProtocol, issue_id: str, comment_id: str, reaction_id: str
) -> None:
    """Delete a reaction on an issue comment."""
    return scm.delete_issue_comment_reaction(issue_id, comment_id, reaction_id)


def get_pull_request_comment_reactions(
    scm: GetPullRequestCommentReactionsProtocol,
    pull_request_id: str,
    comment_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[ReactionResult]:
    """Get reactions on a pull request comment."""
    return scm.get_pull_request_comment_reactions(
        pull_request_id, comment_id, pagination, request_options
    )


def create_pull_request_comment_reaction(
    scm: CreatePullRequestCommentReactionProtocol,
    pull_request_id: str,
    comment_id: str,
    reaction: Reaction,
) -> ActionResult[ReactionResult]:
    """Create a reaction on a pull request comment."""
    return scm.create_pull_request_comment_reaction(pull_request_id, comment_id, reaction)


def delete_pull_request_comment_reaction(
    scm: DeletePullRequestCommentReactionProtocol,
    pull_request_id: str,
    comment_id: str,
    reaction_id: str,
) -> None:
    """Delete a reaction on a pull request comment."""
    return scm.delete_pull_request_comment_reaction(pull_request_id, comment_id, reaction_id)


def get_issue_reactions(
    scm: GetIssueReactionsProtocol,
    issue_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[ReactionResult]:
    """Get reactions on an issue."""
    return scm.get_issue_reactions(issue_id, pagination, request_options)


def create_issue_reaction(
    scm: CreateIssueReactionProtocol, issue_id: str, reaction: Reaction
) -> ActionResult[ReactionResult]:
    """Create a reaction on an issue."""
    return scm.create_issue_reaction(issue_id, reaction)


def delete_issue_reaction(
    scm: DeleteIssueReactionProtocol, issue_id: str, reaction_id: str
) -> None:
    """Delete a reaction on an issue."""
    return scm.delete_issue_reaction(issue_id, reaction_id)


def get_pull_request_reactions(
    scm: GetPullRequestReactionsProtocol,
    pull_request_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[ReactionResult]:
    """Get reactions on a pull request."""
    return scm.get_pull_request_reactions(pull_request_id, pagination, request_options)


def create_pull_request_reaction(
    scm: CreatePullRequestReactionProtocol, pull_request_id: str, reaction: Reaction
) -> ActionResult[ReactionResult]:
    """Create a reaction on a pull request."""
    return scm.create_pull_request_reaction(pull_request_id, reaction)


def delete_pull_request_reaction(
    scm: DeletePullRequestReactionProtocol, pull_request_id: str, reaction_id: str
) -> None:
    """Delete a reaction on a pull request."""
    return scm.delete_pull_request_reaction(pull_request_id, reaction_id)


def get_branch(
    scm: GetBranchProtocol,
    branch: BranchName,
    request_options: RequestOptions | None = None,
) -> ActionResult[GitRef]:
    """Get a branch reference."""
    return scm.get_branch(branch, request_options)


def create_branch(scm: CreateBranchProtocol, branch: BranchName, sha: SHA) -> ActionResult[GitRef]:
    """Create a new branch pointing at the given SHA."""
    return scm.create_branch(branch, sha)


def update_branch(
    scm: UpdateBranchProtocol, branch: BranchName, sha: SHA, force: bool = False
) -> ActionResult[GitRef]:
    """Update a branch to point at a new SHA."""
    return scm.update_branch(branch, sha, force)


def create_git_blob(
    scm: CreateGitBlobProtocol, content: str, encoding: str
) -> ActionResult[GitBlob]:
    """Create a git blob object."""
    return scm.create_git_blob(content, encoding)


def get_file_content(
    scm: GetFileContentProtocol,
    path: str,
    ref: str | None = None,
    request_options: RequestOptions | None = None,
) -> ActionResult[FileContent]:
    return scm.get_file_content(path, ref, request_options)


def get_commit(
    scm: GetCommitProtocol,
    sha: SHA,
    request_options: RequestOptions | None = None,
) -> ActionResult[Commit]:
    return scm.get_commit(sha, request_options)


def get_commits(
    scm: GetCommitsProtocol,
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
    return scm.get_commits(ref=ref, pagination=pagination, request_options=request_options)


def get_commits_by_path(
    scm: GetCommitsByPathProtocol,
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
    return scm.get_commits_by_path(
        path=path, ref=ref, pagination=pagination, request_options=request_options
    )


def compare_commits(
    scm: CompareCommitsProtocol,
    start_sha: SHA,
    end_sha: SHA,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[Commit]:
    return scm.compare_commits(start_sha, end_sha, pagination, request_options)


def get_tree(
    scm: GetTreeProtocol,
    tree_sha: SHA,
    recursive: bool = True,
    request_options: RequestOptions | None = None,
) -> ActionResult[GitTree]:
    return scm.get_tree(tree_sha, recursive=recursive, request_options=request_options)


def get_git_commit(
    scm: GetGitCommitProtocol,
    sha: SHA,
    request_options: RequestOptions | None = None,
) -> ActionResult[GitCommitObject]:
    return scm.get_git_commit(sha, request_options)


def create_git_tree(
    scm: CreateGitTreeProtocol,
    tree: list[InputTreeEntry],
    base_tree: SHA | None = None,
) -> ActionResult[GitTree]:
    return scm.create_git_tree(tree, base_tree=base_tree)


def create_git_commit(
    scm: CreateGitCommitProtocol, message: str, tree_sha: SHA, parent_shas: list[SHA]
) -> ActionResult[GitCommitObject]:
    return scm.create_git_commit(message, tree_sha, parent_shas)


def get_pull_request_files(
    scm: GetPullRequestFilesProtocol,
    pull_request_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[PullRequestFile]:
    return scm.get_pull_request_files(pull_request_id, pagination, request_options)


def get_pull_request_commits(
    scm: GetPullRequestCommitsProtocol,
    pull_request_id: str,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[PullRequestCommit]:
    return scm.get_pull_request_commits(pull_request_id, pagination, request_options)


def get_pull_request_diff(
    scm: GetPullRequestDiffProtocol,
    pull_request_id: str,
    request_options: RequestOptions | None = None,
) -> ActionResult[str]:
    return scm.get_pull_request_diff(pull_request_id, request_options)


def get_pull_requests(
    scm: GetPullRequestsProtocol,
    state: PullRequestState | None = "open",
    head: BranchName | None = None,
    pagination: PaginationParams | None = None,
    request_options: RequestOptions | None = None,
) -> PaginatedActionResult[PullRequest]:
    return scm.get_pull_requests(state, head, pagination, request_options)


def create_pull_request(
    scm: CreatePullRequestProtocol,
    title: str,
    body: str,
    head: BranchName,
    base: BranchName,
) -> ActionResult[PullRequest]:
    return scm.create_pull_request(title, body, head, base)


def create_pull_request_draft(
    scm: CreatePullRequestDraftProtocol,
    title: str,
    body: str,
    head: BranchName,
    base: BranchName,
) -> ActionResult[PullRequest]:
    return scm.create_pull_request_draft(title, body, head, base)


def update_pull_request(
    scm: UpdatePullRequestProtocol,
    pull_request_id: str,
    title: str | None = None,
    body: str | None = None,
    state: PullRequestState | None = None,
) -> ActionResult[PullRequest]:
    return scm.update_pull_request(pull_request_id, title=title, body=body, state=state)


def request_review(scm: RequestReviewProtocol, pull_request_id: str, reviewers: list[str]) -> None:
    return scm.request_review(pull_request_id, reviewers)


def create_review_comment_file(
    scm: CreateReviewCommentFileProtocol,
    pull_request_id: str,
    commit_id: SHA,
    body: str,
    path: str,
    side: ReviewSide,
) -> ActionResult[ReviewComment]:
    """Leave a review comment on a file."""
    return scm.create_review_comment_file(pull_request_id, commit_id, body, path, side)


def create_review_comment_reply(
    scm: CreateReviewCommentReplyProtocol,
    pull_request_id: str,
    body: str,
    comment_id: str,
) -> ActionResult[ReviewComment]:
    """Leave a review comment in reply to another review comment."""
    return scm.create_review_comment_reply(pull_request_id, body, comment_id)


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
        output=output,
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


def get_archive_link(
    scm: GetArchiveLinkProtocol,
    ref: str,
    archive_format: ArchiveFormat = "tarball",
) -> ActionResult[ArchiveLink]:
    """Get a URL to download a repository archive."""
    return scm.get_archive_link(ref, archive_format)


__all__ = (
    "SourceCodeManager",
    "compare_commits",
    "create_branch",
    "create_check_run",
    "create_git_blob",
    "create_git_commit",
    "create_git_tree",
    "create_issue_comment_reaction",
    "create_issue_comment",
    "create_issue_reaction",
    "create_pull_request_comment_reaction",
    "create_pull_request_comment",
    "create_pull_request_draft",
    "create_pull_request_reaction",
    "create_pull_request",
    "create_review_comment_file",
    "create_review_comment_reply",
    "create_review",
    "delete_issue_comment_reaction",
    "delete_issue_comment",
    "delete_issue_reaction",
    "delete_pull_request_comment_reaction",
    "delete_pull_request_comment",
    "delete_pull_request_reaction",
    "get_archive_link",
    "get_branch",
    "get_check_run",
    "get_commit",
    "get_commits_by_path",
    "get_commits",
    "get_file_content",
    "get_git_commit",
    "get_issue_comment_reactions",
    "get_issue_comments",
    "get_issue_reactions",
    "get_pull_request_comment_reactions",
    "get_pull_request_comments",
    "get_pull_request_commits",
    "get_pull_request_diff",
    "get_pull_request_files",
    "get_pull_request_reactions",
    "get_pull_request",
    "get_pull_requests",
    "get_tree",
    "minimize_comment",
    "request_review",
    "update_branch",
    "update_check_run",
    "update_pull_request",
)
