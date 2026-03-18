from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Required, TypedDict

type Action = Literal["check_run", "comment", "pull_request"]
type EventType = "CheckRunEvent" | "CommentEvent" | "PullRequestEvent"
type EventTypeHint = Literal["check_run", "comment", "pull_request"]
type HybridCloudSilo = Literal["control", "region"]


type ProviderName = Literal["bitbucket", "github", "github_enterprise", "gitlab"]
"""The SCM provider that owns an integration or repository."""

PROVIDER_SET: set[ProviderName] = set(["bitbucket", "github", "github_enterprise", "gitlab"])

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

type ArchiveFormat = Literal["tar.gz", "zip"]
"""Normalized archive format identifiers shared across all SCM providers."""


class ArchiveLink(TypedDict):
    """A download URL bundled with the authentication headers required to fetch it."""

    url: str
    headers: dict[str, str]


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

    sha: SHA | None
    ref: BranchName


class PullRequest(TypedDict):
    """Provider-agnostic representation of a pull request."""

    # @todo Why do we have two ids here? Confusing.
    id: ResourceId
    number: str
    title: str
    body: str | None
    state: PullRequestState
    merged: bool
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
    is_active: bool
    external_id: str | None


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
    files: list[CommitFile] | None


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
    html_url: str | None
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


class SubscriptionEvent(TypedDict):
    """
    A "SubscriptionEvent" is an event that was sent by a source control management (SCM)
    service-provider. This type wraps the event and appends special metadata to aid processing
    and monitoring.

    All service provider events must be validated as authentic prior to being transformed to this
    type.
    """

    received_at: int
    """The UTC timestamp (in seconds) the event was received by Sentry's servers."""

    type: ProviderName
    """
    The name of the service provider who sent the event. A stringy enum value of "github",
    "gitlab", etc. For more information see the "ProviderName" type definition.
    """

    event_type_hint: str | None
    """
    Source control management service providers may send headers which hint at the event's
    contents. This hint is optionally provided to the consuming process and may be used to ignore
    unwanted events without deserializing the event body itself.
    """

    event: str
    """
    The event sent by the service provider. Typically a JSON object. The exact format is
    determined by the "type" field.
    """

    extra: dict[str, str | None | bool | int | float]
    """
    An arbitrary mapping of key, value pairs extracted from the request headers of the message or
    the local Sentry environment. The type is provider specific and can be determined by
    investigating the target integrations webhook.py file.
    """

    sentry_meta: list["SubscriptionEventSentryMeta"] | None
    """
    If the event is opportunistically associated with internal Sentry metadata then that metadata
    is specified here. If this data is not present your process will need to derive it from the
    event.

    This is included with GitLab requests but not with GitHub requests. This is because it is
    necessary to derive this metadata to authenticate the request. GitHub requests do not need to
    query for this metadata to authenticate their requests. Querying for Sentry metadata is left
    as an exercise for the implementer if not provided.
    """


class SubscriptionEventSentryMeta(TypedDict):
    id: int | None
    """
    "OrganizationIntegration" model identifier. Optionally specified. Only specified if the
    installation has been explicitly queried.
    """

    integration_id: int | None
    """
    "Integration" model identifier.
    """

    organization_id: int | None
    """
    "Organization" model identifier.
    """


type CheckRunAction = Literal["completed", "created", "requested_action", "rerequested"]


class CheckRunEventData(TypedDict):
    external_id: str
    html_url: str


@dataclass(frozen=True)
class CheckRunEvent:
    action: CheckRunAction
    """The action that triggered the event. An enumeration of string values."""

    check_run: CheckRunEventData
    """"""

    subscription_event: SubscriptionEvent
    """
    The subscription event that was received by Sentry. This field contains the raw instructions
    which parsed the action and check_run fields. You can use this field to perform additional
    parsing if the default implementation is lacking.

    This field will also include any extra metadata that was generated prior to being submitted to
    the listener. In some cases, Sentry will query the database for information. This information
    is stored in the "sentry_meta" field and is accessible without performing redundant queries.
    """


type CommentAction = Literal["created", "deleted", "edited", "pinned", "unpinned"]
type CommentType = Literal["issue", "pull_request"]


class CommentEventData(TypedDict):
    id: str
    body: str | None
    author: Author | None


@dataclass(frozen=True)
class CommentEvent:
    """ """

    action: CommentAction
    """The action that triggered the event. An enumeration of string values."""

    comment_type: CommentType
    """"""

    comment: CommentEventData
    """"""

    subscription_event: SubscriptionEvent
    """
    The subscription event that was received by Sentry. This field contains the raw instructions
    which parsed the action and comment fields. You can use this field to perform additional
    parsing if the default implementation is lacking.

    This field will also include any extra metadata that was generated prior to being submitted to
    the listener. In some cases, Sentry will query the database for information. This information
    is stored in the "sentry_meta" field and is accessible without performing redundant queries.
    """


type PullRequestAction = Literal[
    "assigned",
    "auto_merge_disabled",
    "auto_merge_enabled",
    "closed",
    "converted_to_draft",
    "demilestoned",  # Removed a milestone.
    "dequeued",  # Removed from merge queue.
    "edited",
    "enqueued",  # Added to merge queue.
    "labeled",
    "locked",
    "milestoned",  # Added a milestone.
    "opened",
    "ready_for_review",
    "reopened",
    "review_request_removed",
    "review_requested",
    "synchronize",  # Commits were pushed.
    "unassigned",
    "unlabeled",
    "unlocked",
]


class PullRequestEventData(TypedDict):
    id: str
    title: str
    description: str | None
    head: PullRequestBranch
    base: PullRequestBranch
    is_private_repo: bool
    author: Author | None


@dataclass(frozen=True)
class PullRequestEvent:
    """
    Pull request event type. This event is received when an action was performed on a pull-request.
    For example, opened, closed, or ready for review.
    """

    action: PullRequestAction
    """The action that triggered the event. An enumeration of string values."""

    pull_request: PullRequestEventData
    """The pull-request that was acted upon."""

    subscription_event: SubscriptionEvent
    """
    The subscription event that was received by Sentry. This field contains the raw instructions
    which parsed the action and pull_request fields. You can use this field to perform additional
    parsing if the default implementation is lacking.

    This field will also include any extra metadata that was generated prior to being submitted to
    the listener. In some cases, Sentry will query the database for information. This information
    is stored in the "sentry_meta" field and is accessible without performing redundant queries.
    """
