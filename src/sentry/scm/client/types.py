from datetime import datetime
from typing import Any, Literal, Required, TypeAlias, TypedDict

ProviderName: TypeAlias = Literal["bitbucket", "github", "github_enterprise", "gitlab"]
"""The SCM provider that owns an integration or repository."""

ExternalId: TypeAlias = str
"""
Identifier whose origin is an external, source-code-management provider. Refers specifically to
the unique identifier of a repository.
"""

ResourceId: TypeAlias = str
"""An opaque provider-assigned identifier for a resource (pull request, review, check run, etc.).

Represented as a string to accommodate providers that use non-integer IDs (e.g. GitLab uses
integers but Bitbucket uses UUIDs). Callers should treat this as opaque and not assume numeric
ordering or format.
"""

Reaction: TypeAlias = Literal["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]
"""Normalized reaction identifiers shared across all SCM providers."""

RepositoryId: TypeAlias = int | tuple[ProviderName, ExternalId]
"""A repository can be identified by its internal DB id or by a (provider, external_id) pair."""

FileStatus: TypeAlias = Literal[
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

BuildStatus: TypeAlias = Literal["pending", "running", "completed"]
"""The lifecycle stage of a CI build.

- pending: created or queued but not yet running
- running: actively executing
- completed: finished; see BuildConclusion for the outcome
"""

BuildConclusion: TypeAlias = Literal[
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

TreeEntryMode: TypeAlias = Literal["100644", "100755", "040000", "160000", "120000"]
"""UNIX file mode for a git tree entry, as stored in a git tree object.

- 100644: regular file (non-executable)
- 100755: executable file
- 040000: directory (subtree)
- 160000: git submodule (gitlink)
- 120000: symbolic link
"""

TreeEntryType: TypeAlias = Literal["blob", "tree", "commit"]
"""The object type stored at a git tree entry.

- blob: a file
- tree: a directory (subtree)
- commit: a submodule reference
"""

ReviewSide: TypeAlias = Literal["LEFT", "RIGHT"]
"""Which side of a diff a review comment is anchored to.

- LEFT: the base (original) side of the diff
- RIGHT: the head (modified) side of the diff
"""

BranchName: TypeAlias = str
SHA: TypeAlias = str
PullRequestState: TypeAlias = Literal["open", "closed"]
ReviewEvent: TypeAlias = Literal["approve", "change_request", "comment"]


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
