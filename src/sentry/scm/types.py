from datetime import datetime
from typing import Any, Literal, Protocol, Required, TypedDict

type ProviderName = Literal["bitbucket", "github", "github_enterprise", "gitlab"]
"""The SCM provider that owns an integration or repository."""

type ExternalId = str
"""
Identifier whose origin is an external, source-code-management provider. Refers specifically to
the unique identifier of a repository.
"""

type ResourceId = str
"""An opaque provider-assigned identifier for a resource (pull request, review, check run, etc.).

Represented as a string to accommodate providers that use non-integer IDs (e.g. GitLab uses
integers but Bitbucket uses UUIDs). Callers should treat this as opaque and not assume numeric
ordering or format.
"""

type Reaction = Literal["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]
"""Normalized reaction identifiers shared across all SCM providers."""

type Referrer = str
"""
Identifies the caller so providers can apply per-referrer rate-limit policies and emit metrics
scoped by referrer.
"""

type RepositoryId = int | tuple[ProviderName, ExternalId]
"""A repository can be identified by its internal DB id or by a (provider, external_id) pair."""

type FileStatus = Literal[
    "added", "removed", "modified", "renamed", "copied", "changed", "unchanged", "unknown"
]
"""The change type applied to a file in a commit or pull request.

- added: file was created
- removed: file was deleted
- modified: file contents changed
- renamed: file was moved; see previous_filename for the old path
- copied: file was duplicated from another path
- changed: file metadata changed without content change (e.g. mode)
- unchanged: file appears in the diff context but was not modified
- unknown: file status could not be positively identified
"""

type BuildStatus = Literal["pending", "running", "completed"]
"""The lifecycle stage of a CI build.

- pending: created or queued but not yet running
- running: actively executing
- completed: finished; see BuildConclusion for the outcome
"""

type BuildConclusion = Literal[
    "success",
    "failure",
    "cancelled",
    "skipped",
    "timed_out",
    "neutral",
    "action_required",
    "unknown",
]
"""The terminal outcome of a completed build.

- success: all checks passed
- failure: one or more checks failed
- cancelled: stopped before completion
- skipped: deliberately bypassed
- timed_out: exceeded the time limit
- neutral: completed without a pass/fail determination
- action_required: requires manual intervention before proceeding
- unknown: outcome could not be determined
"""

type TreeEntryMode = Literal["100644", "100755", "040000", "160000", "120000"]
"""UNIX file mode for a git tree entry, as stored in a git tree object.

- 100644: regular file (non-executable)
- 100755: executable file
- 040000: directory (subtree)
- 160000: git submodule (gitlink)
- 120000: symbolic link
"""

type TreeEntryType = Literal["blob", "tree", "commit"]
"""The object type stored at a git tree entry.

- blob: a file
- tree: a directory (subtree)
- commit: a submodule reference
"""

type ReviewSide = Literal["LEFT", "RIGHT"]
"""Which side of a diff a review comment is anchored to.

- LEFT: the base (original) side of the diff
- RIGHT: the head (modified) side of the diff
"""

type BranchName = str
type SHA = str
type PullRequestState = Literal["open", "closed"]
type ReviewEvent = Literal["approve", "change_request", "comment"]


class PaginationParams(TypedDict, total=False):
    """Controls page traversal for list endpoints.

    - cursor: an opaque token returned from a previous page's `next_cursor`
    - per_page: how many items to return per page
    """

    cursor: str
    per_page: int


class RequestOptions(TypedDict, total=False):
    """Transport-level options for single-resource fetches.

    - if_none_match: send an `If-None-Match` header (ETag-based caching)
    - if_modified_since: send an `If-Modified-Since` header (UTC datetime)
    """

    if_none_match: str
    if_modified_since: datetime


class ResponseMeta(TypedDict, total=False):
    """Transport-level metadata attached to a single-resource provider response.

    - etag: the `ETag` header value, usable in a subsequent `if_none_match`
    - last_modified: UTC datetime parsed from the `Last-Modified` header
    """

    etag: str
    last_modified: datetime


class PaginatedResponseMeta(TypedDict, total=False):
    """Transport-level metadata attached to a paginated provider response.

    Carries all fields from `ResponseMeta` plus a required `next_cursor`
    that callers can pass back to `PaginationParams.cursor` to fetch the
    next page. `None` means there are no more pages.
    """

    etag: str
    last_modified: datetime
    next_cursor: Required[str | None]


class Author(TypedDict):
    """Normalized author identity returned by all SCM providers."""

    id: ResourceId
    username: str


class Comment(TypedDict):
    """Provider-agnostic representation of an issue or pull-request comment."""

    id: ResourceId
    body: str | None
    author: Author | None


class ReactionResult(TypedDict):
    """Provider-agnostic representation of a reaction on an issue, comment, or pull request."""

    id: ResourceId
    content: Reaction
    author: Author | None


class PullRequestBranch(TypedDict):
    """A branch reference within a pull request (head or base)."""

    sha: SHA
    ref: BranchName


class PullRequest(TypedDict):
    """Provider-agnostic representation of a pull request."""

    id: ResourceId
    number: int
    title: str
    body: str | None
    state: PullRequestState
    merged: bool
    url: str
    html_url: str
    head: PullRequestBranch
    base: PullRequestBranch


class ActionResult[T](TypedDict):
    """Wraps a provider response with metadata and the original API payload.

    Pairs a normalized domain object with the provider name and raw API
    payload. This lets callers work with a stable interface while still
    having access to provider-specific fields when needed.

    The `meta` field carries transport-level metadata such as ETags.
    Pass an empty dict when the provider does not supply any metadata.
    """

    data: T
    type: ProviderName
    raw: Any
    meta: ResponseMeta


class PaginatedActionResult[T](TypedDict):
    """Wraps a paginated provider response.

    Identical to `ActionResult` but carries a `PaginatedResponseMeta` with a required
    `page_info`, guaranteeing that callers of list endpoints always have access to pagination
    state.
    """

    data: list[T]
    type: ProviderName
    raw: Any
    meta: PaginatedResponseMeta


class Repository(TypedDict):
    """Identifies a repository within a Sentry integration."""

    integration_id: int
    name: str
    organization_id: int
    status: int


class GitRef(TypedDict):
    """A git reference (branch pointer)."""

    ref: BranchName
    sha: SHA


class GitBlob(TypedDict):
    sha: SHA


class FileContent(TypedDict):
    path: str
    sha: SHA
    content: str  # base64-encoded
    encoding: str
    size: int


class CommitAuthor(TypedDict):
    name: str
    email: str
    date: datetime | None


class CommitFile(TypedDict):
    filename: str
    status: FileStatus
    patch: str | None


class Commit(TypedDict):
    id: SHA
    message: str
    author: CommitAuthor | None
    files: list[CommitFile]


class CommitComparison(TypedDict):
    ahead_by: int
    behind_by: int
    commits: list[Commit]


class TreeEntry(TypedDict):
    path: str
    mode: TreeEntryMode
    type: TreeEntryType
    sha: SHA
    size: int | None


class InputTreeEntry(TypedDict):
    path: str
    mode: TreeEntryMode
    type: TreeEntryType
    sha: SHA | None  # None for deletions


class GitTree(TypedDict):
    sha: SHA
    tree: list[TreeEntry]
    truncated: bool


class GitCommitTree(TypedDict):
    sha: SHA


class GitCommitObject(TypedDict):
    sha: SHA
    tree: GitCommitTree
    message: str


class PullRequestFile(TypedDict):
    filename: str
    status: FileStatus
    patch: str | None
    changes: int
    sha: SHA
    previous_filename: str | None


class PullRequestCommit(TypedDict):
    sha: SHA
    message: str
    author: CommitAuthor | None


class ReviewCommentInput(TypedDict, total=False):
    """Input for an inline comment within a batch review."""

    path: Required[str]
    body: Required[str]
    line: int
    side: ReviewSide
    start_line: int
    start_side: ReviewSide


class ReviewComment(TypedDict):
    """Provider-agnostic representation of a review comment."""

    id: ResourceId
    html_url: str
    path: str
    body: str


class Review(TypedDict):
    """Provider-agnostic representation of a pull request review."""

    id: ResourceId
    html_url: str


class CheckRunOutput(TypedDict, total=False):
    """Output annotation for a check run."""

    title: Required[str]
    summary: Required[str]
    text: str


class CheckRun(TypedDict):
    """Provider-agnostic representation of a check run."""

    id: ResourceId
    name: str
    status: BuildStatus
    conclusion: BuildConclusion | None
    html_url: str


class Provider(Protocol):
    """
    Providers abstract over an integration. They map generic commands to service-provider specific
    commands and they map the results of those commands to generic result-types.

    Providers necessarily offer a larger API surface than what is available in an integration. Some
    methods may be duplicates in some providers. This is intentional. Providers capture programmer
    intent and translate it into a concrete interface. Therefore, providers provide a large range
    of behaviors which may or may not be explicitly defined on a service-provider.
    """

    repository: Repository

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool: ...

    # -- Single-resource endpoints ------------------------------------------------

    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]: ...

    def get_branch(
        self,
        branch: BranchName,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]: ...

    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]: ...

    def get_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]: ...

    def get_tree(
        self,
        tree_sha: SHA,
        recursive: bool = True,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitTree]: ...

    def get_git_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitCommitObject]: ...

    def get_pull_request_diff(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[str]: ...

    def get_check_run(
        self,
        check_run_id: ResourceId,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[CheckRun]: ...

    # -- List endpoints ---------------------------------------------------------

    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]: ...

    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]: ...

    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]: ...

    def get_pull_request_comment_reactions(
        self,
        pull_request_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]: ...

    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]: ...

    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]: ...

    def get_commits(
        self,
        sha: SHA | None = None,
        path: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]: ...

    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]: ...

    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]: ...

    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        head: BranchName | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]: ...

    def compare_commits(
        self,
        start_sha: SHA,
        end_sha: SHA,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]: ...

    # -- Mutations --------------------------------------------------------------

    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]: ...

    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None: ...

    def create_pull_request_comment(
        self, pull_request_id: str, body: str
    ) -> ActionResult[Comment]: ...

    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None: ...

    def create_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...

    def delete_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction_id: str
    ) -> None: ...

    def create_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...

    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None: ...

    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...

    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None: ...

    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None: ...

    def create_branch(self, branch: BranchName, sha: SHA) -> ActionResult[GitRef]: ...

    def update_branch(
        self, branch: BranchName, sha: SHA, force: bool = False
    ) -> ActionResult[GitRef]: ...

    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]: ...

    def create_git_tree(
        self, tree: list[InputTreeEntry], base_tree: SHA | None = None
    ) -> ActionResult[GitTree]: ...

    def create_git_commit(
        self, message: str, tree_sha: SHA, parent_shas: list[SHA]
    ) -> ActionResult[GitCommitObject]: ...

    def create_pull_request(
        self,
        title: str,
        body: str,
        head: BranchName,
        base: BranchName,
        draft: bool = False,
    ) -> ActionResult[PullRequest]: ...

    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: PullRequestState | None = None,
    ) -> ActionResult[PullRequest]: ...

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None: ...

    def create_review_comment_file(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]: ...

    def create_review_comment_line(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        line: int,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]: ...

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

    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]: ...

    def create_review(
        self,
        pull_request_id: str,
        commit_sha: SHA,
        event: ReviewEvent,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ActionResult[Review]: ...

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

    def update_check_run(
        self,
        check_run_id: ResourceId,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]: ...

    def minimize_comment(self, comment_node_id: str, reason: str) -> None: ...

    def resolve_review_thread(self, thread_node_id: str) -> None: ...
