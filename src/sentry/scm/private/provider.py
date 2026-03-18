from typing import Protocol, runtime_checkable

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
    RequestOptions,
    ResourceId,
    Review,
    ReviewComment,
    ReviewCommentInput,
    ReviewEvent,
    ReviewSide,
)

# Issue Comment Protocols


@runtime_checkable
class GetIssueCommentsProtocol(Protocol):
    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]: ...


@runtime_checkable
class CreateIssueCommentProtocol(Protocol):
    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]: ...


@runtime_checkable
class DeleteIssueCommentProtocol(Protocol):
    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None: ...


# Pull Request Comment Protocols


@runtime_checkable
class GetPullRequestCommentsProtocol(Protocol):
    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]: ...


@runtime_checkable
class CreatePullRequestCommentProtocol(Protocol):
    def create_pull_request_comment(
        self, pull_request_id: str, body: str
    ) -> ActionResult[Comment]: ...


@runtime_checkable
class DeletePullRequestCommentProtocol(Protocol):
    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None: ...


# Issue Comment Reaction Protocols


@runtime_checkable
class GetIssueCommentReactionsProtocol(Protocol):
    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]: ...


@runtime_checkable
class CreateIssueCommentReactionProtocol(Protocol):
    def create_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...


@runtime_checkable
class DeleteIssueCommentReactionProtocol(Protocol):
    def delete_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction_id: str
    ) -> None: ...


# Pull Request Comment Reaction Protocols


@runtime_checkable
class GetPullRequestCommentReactionsProtocol(Protocol):
    def get_pull_request_comment_reactions(
        self,
        pull_request_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]: ...


@runtime_checkable
class CreatePullRequestCommentReactionProtocol(Protocol):
    def create_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...


@runtime_checkable
class DeletePullRequestCommentReactionProtocol(Protocol):
    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None: ...


# Issue Reaction Protocols


@runtime_checkable
class GetIssueReactionsProtocol(Protocol):
    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]: ...


@runtime_checkable
class CreateIssueReactionProtocol(Protocol):
    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...


@runtime_checkable
class DeleteIssueReactionProtocol(Protocol):
    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None: ...


# Pull Request Reaction Protocols


@runtime_checkable
class GetPullRequestReactionsProtocol(Protocol):
    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]: ...


@runtime_checkable
class CreatePullRequestReactionProtocol(Protocol):
    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...


@runtime_checkable
class DeletePullRequestReactionProtocol(Protocol):
    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None: ...


# Branch Protocols


@runtime_checkable
class GetBranchProtocol(Protocol):
    def get_branch(
        self,
        branch: BranchName,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]: ...


@runtime_checkable
class CreateBranchProtocol(Protocol):
    def create_branch(self, branch: BranchName, sha: SHA) -> ActionResult[GitRef]: ...


@runtime_checkable
class UpdateBranchProtocol(Protocol):
    def update_branch(
        self, branch: BranchName, sha: SHA, force: bool = False
    ) -> ActionResult[GitRef]: ...


# Commit Protocols


@runtime_checkable
class GetCommitProtocol(Protocol):
    def get_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]: ...


@runtime_checkable
class GetCommitsProtocol(Protocol):
    def get_commits(
        self,
        ref: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]: ...


@runtime_checkable
class GetCommitsByPathProtocol(Protocol):
    def get_commits_by_path(
        self,
        path: str,
        ref: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]: ...


@runtime_checkable
class CompareCommitsProtocol(Protocol):
    def compare_commits(
        self,
        start_sha: SHA,
        end_sha: SHA,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]: ...


# Pull Request Protocols


@runtime_checkable
class GetPullRequestProtocol(Protocol):
    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]: ...


@runtime_checkable
class GetPullRequestsProtocol(Protocol):
    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        head: BranchName | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]: ...


@runtime_checkable
class GetPullRequestFilesProtocol(Protocol):
    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]: ...


@runtime_checkable
class GetPullRequestCommitsProtocol(Protocol):
    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]: ...


@runtime_checkable
class GetPullRequestDiffProtocol(Protocol):
    def get_pull_request_diff(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[str]: ...


@runtime_checkable
class CreatePullRequestProtocol(Protocol):
    def create_pull_request(
        self,
        title: str,
        body: str,
        head: BranchName,
        base: BranchName,
    ) -> ActionResult[PullRequest]: ...


@runtime_checkable
class CreatePullRequestDraftProtocol(Protocol):
    def create_pull_request_draft(
        self,
        title: str,
        body: str,
        head: BranchName,
        base: BranchName,
    ) -> ActionResult[PullRequest]: ...


@runtime_checkable
class UpdatePullRequestProtocol(Protocol):
    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: PullRequestState | None = None,
    ) -> ActionResult[PullRequest]: ...


@runtime_checkable
class RequestReviewProtocol(Protocol):
    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None: ...


# Git Object Protocols


@runtime_checkable
class GetTreeProtocol(Protocol):
    def get_tree(
        self,
        tree_sha: SHA,
        recursive: bool = True,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitTree]: ...


@runtime_checkable
class GetGitCommitProtocol(Protocol):
    def get_git_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitCommitObject]: ...


@runtime_checkable
class CreateGitBlobProtocol(Protocol):
    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]: ...


@runtime_checkable
class CreateGitTreeProtocol(Protocol):
    def create_git_tree(
        self, tree: list[InputTreeEntry], base_tree: SHA | None = None
    ) -> ActionResult[GitTree]: ...


@runtime_checkable
class CreateGitCommitProtocol(Protocol):
    def create_git_commit(
        self, message: str, tree_sha: SHA, parent_shas: list[SHA]
    ) -> ActionResult[GitCommitObject]: ...


# File Content Protocol


@runtime_checkable
class GetFileContentProtocol(Protocol):
    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]: ...


# Archive Protocols


@runtime_checkable
class GetArchiveLinkProtocol(Protocol):
    def get_archive_link(
        self,
        ref: str,
        archive_format: ArchiveFormat = "tar.gz",
    ) -> ActionResult[ArchiveLink]: ...


# Check Run Protocols


@runtime_checkable
class GetCheckRunProtocol(Protocol):
    def get_check_run(
        self,
        check_run_id: ResourceId,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[CheckRun]: ...


@runtime_checkable
class CreateCheckRunProtocol(Protocol):
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
    ) -> ActionResult[CheckRun]: ...


@runtime_checkable
class UpdateCheckRunProtocol(Protocol):
    def update_check_run(
        self,
        check_run_id: ResourceId,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]: ...


# Review Protocols


@runtime_checkable
class CreateReviewCommentFileProtocol(Protocol):
    def create_review_comment_file(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]: ...


@runtime_checkable
class CreateReviewCommentLineProtocol(Protocol):
    def create_review_comment_line(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        line: int,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]: ...


@runtime_checkable
class CreateReviewCommentMultilineProtocol(Protocol):
    def create_review_comment_multiline(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        start_line: int,
        start_side: ReviewSide,
        end_line: int,
        end_side: ReviewSide,
    ) -> ActionResult[ReviewComment]: ...


@runtime_checkable
class CreateReviewCommentReplyProtocol(Protocol):
    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]: ...


@runtime_checkable
class CreateReviewProtocol(Protocol):
    def create_review(
        self,
        pull_request_id: str,
        commit_sha: SHA,
        event: ReviewEvent,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ActionResult[Review]: ...


# Moderation Protocols


@runtime_checkable
class MinimizeCommentProtocol(Protocol):
    def minimize_comment(self, comment_node_id: str, reason: str) -> None: ...


@runtime_checkable
class ResolveReviewThreadProtocol(Protocol):
    def resolve_review_thread(self, thread_node_id: str) -> None: ...


class ActionMap:
    get_issue_comments = GetIssueCommentsProtocol
    create_issue_comment = CreateIssueCommentProtocol
    delete_issue_comment = DeleteIssueCommentProtocol
    get_pull_request_comments = GetPullRequestCommentsProtocol
    create_pull_request_comment = CreatePullRequestCommentProtocol
    delete_pull_request_comment = DeletePullRequestCommentProtocol
    get_issue_comment_reactions = GetIssueCommentReactionsProtocol
    create_issue_comment_reaction = CreateIssueCommentReactionProtocol
    delete_issue_comment_reaction = DeleteIssueCommentReactionProtocol
    get_pull_request_comment_reactions = GetPullRequestCommentReactionsProtocol
    create_pull_request_comment_reaction = CreatePullRequestCommentReactionProtocol
    delete_pull_request_comment_reaction = DeletePullRequestCommentReactionProtocol
    get_issue_reactions = GetIssueReactionsProtocol
    create_issue_reaction = CreateIssueReactionProtocol
    delete_issue_reaction = DeleteIssueReactionProtocol
    get_pull_request_reactions = GetPullRequestReactionsProtocol
    create_pull_request_reaction = CreatePullRequestReactionProtocol
    delete_pull_request_reaction = DeletePullRequestReactionProtocol
    get_branch = GetBranchProtocol
    create_branch = CreateBranchProtocol
    update_branch = UpdateBranchProtocol
    get_commit = GetCommitProtocol
    get_commits = GetCommitsProtocol
    get_commits_by_path = GetCommitsByPathProtocol
    compare_commits = CompareCommitsProtocol
    get_pull_request = GetPullRequestProtocol
    get_pull_requests = GetPullRequestsProtocol
    get_pull_request_files = GetPullRequestFilesProtocol
    get_pull_request_commits = GetPullRequestCommitsProtocol
    get_pull_request_diff = GetPullRequestDiffProtocol
    create_pull_request = CreatePullRequestProtocol
    create_pull_request_draft = CreatePullRequestDraftProtocol
    update_pull_request = UpdatePullRequestProtocol
    request_review = RequestReviewProtocol
    get_tree = GetTreeProtocol
    get_git_commit = GetGitCommitProtocol
    create_git_blob = CreateGitBlobProtocol
    create_git_tree = CreateGitTreeProtocol
    create_git_commit = CreateGitCommitProtocol
    get_file_content = GetFileContentProtocol
    get_archive_link = GetArchiveLinkProtocol
    get_check_run = GetCheckRunProtocol
    create_check_run = CreateCheckRunProtocol
    update_check_run = UpdateCheckRunProtocol
    create_review_comment_file = CreateReviewCommentFileProtocol
    create_review_comment_line = CreateReviewCommentLineProtocol
    create_review_comment_multiline = CreateReviewCommentMultilineProtocol
    create_review_comment_reply = CreateReviewCommentReplyProtocol
    create_review = CreateReviewProtocol
    minimize_comment = MinimizeCommentProtocol
    resolve_review_thread = ResolveReviewThreadProtocol


class Provider(Protocol):
    """
    Providers abstract over an integration. They map generic commands to service-provider specific
    commands and they map the results of those commands to generic result-types.

    Providers necessarily offer a larger API surface than what is available in an integration. Some
    methods may be duplicates in some providers. This is intentional. Providers capture programmer
    intent and translate it into a concrete interface. Therefore, providers provide a large range
    of behaviors which may or may not be explicitly defined on a service-provider.

    Providers, also by necessity, offer a smaller API surface than what the SCM platform can
    maximally provide. There are simply some operations which can not be adequately translated
    between providers. None the less, we want to have a service-agnostic interface. This problem
    is solved with capability-object-like system. Capabilities are progressively opted into using
    structural sub-typing. As a provider's surface area expands the SourceCodeManager class will
    automatically recognize that the provider has a particular capability and return "true" when
    handling "can" requests.
    """

    organization_id: int
    repository: Repository

    def is_rate_limited(self, referrer: Referrer) -> bool: ...
