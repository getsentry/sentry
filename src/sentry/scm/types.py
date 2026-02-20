from typing import Any, Literal, Protocol, Required, TypedDict

type ProviderName = Literal["bitbucket", "github", "github_enterprise", "gitlab"]
"""The SCM provider that owns an integration or repository."""

type ExternalId = str

type ResourceId = str
"""An opaque provider-assigned identifier for a resource (pull request, review, check run, etc.).

Represented as a string to accommodate providers that use non-integer IDs (e.g. GitLab uses
integers but Bitbucket uses UUIDs). Callers should treat this as opaque and not assume numeric
ordering or format.
"""

type Reaction = Literal["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]
"""Normalized reaction identifiers shared across all SCM providers."""

type Referrer = Literal["emerge", "shared"]
"""
Identifies the caller so providers can apply per-referrer rate-limit policies and emit metrics
scoped by referrer.
"""

type RepositoryId = int | tuple[ProviderName, ExternalId]
"""A repository can be identified by its internal DB id or by a (provider, external_id) pair."""

type FileStatus = Literal[
    "added", "removed", "modified", "renamed", "copied", "changed", "unchanged"
]
"""The change type applied to a file in a commit or pull request.

- added: file was created
- removed: file was deleted
- modified: file contents changed
- renamed: file was moved; see previous_filename for the old path
- copied: file was duplicated from another path
- changed: file metadata changed without content change (e.g. mode)
- unchanged: file appears in the diff context but was not modified
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


class Author(TypedDict):
    """Normalized author identity returned by all SCM providers."""

    id: str
    username: str


class Comment(TypedDict):
    """Provider-agnostic representation of an issue or pull-request comment."""

    id: str
    body: str | None
    author: Author | None


class ReactionResult(TypedDict):
    """Provider-agnostic representation of a reaction on an issue, comment, or pull request."""

    id: str
    content: Reaction
    author: Author | None


class PullRequestBranch(TypedDict):
    """A branch reference within a pull request (head or base)."""

    sha: str
    ref: str


class PullRequest(TypedDict):
    """Provider-agnostic representation of a pull request."""

    id: ResourceId
    number: int
    title: str
    body: str | None
    state: Literal["open", "closed"]
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
    """

    data: T
    type: ProviderName
    raw: dict[str, Any]


class Repository(TypedDict):
    """Identifies a repository within a Sentry integration."""

    integration_id: int
    name: str
    organization_id: int
    status: int


class GitRef(TypedDict):
    """A git reference (branch pointer)."""

    ref: str
    sha: str


class GitBlob(TypedDict):
    sha: str


class FileContent(TypedDict):
    path: str
    sha: str
    content: str  # base64-encoded
    encoding: str
    size: int


class CommitAuthor(TypedDict):
    name: str
    email: str
    date: str


class CommitFile(TypedDict):
    filename: str
    status: FileStatus
    patch: str | None


class Commit(TypedDict):
    sha: str
    message: str
    author: CommitAuthor | None
    files: list[CommitFile]


class CommitComparison(TypedDict):
    ahead_by: int
    behind_by: int


class TreeEntry(TypedDict):
    path: str
    mode: TreeEntryMode
    type: TreeEntryType
    sha: str
    size: int | None


class InputTreeEntry(TypedDict):
    path: str
    mode: TreeEntryMode
    type: TreeEntryType
    sha: str | None  # None for deletions


class GitTree(TypedDict):
    tree: list[TreeEntry]
    truncated: bool


class GitCommitTree(TypedDict):
    sha: str


class GitCommitObject(TypedDict):
    sha: str
    tree: GitCommitTree
    message: str


class PullRequestFile(TypedDict):
    filename: str
    status: FileStatus
    patch: str | None
    changes: int
    sha: str
    previous_filename: str | None


class PullRequestCommit(TypedDict):
    sha: str
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

    def get_pull_request(self, pull_request_id: str) -> ActionResult[PullRequest]: ...

    def get_issue_comments(self, issue_id: str) -> list[ActionResult[Comment]]: ...

    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]: ...

    def delete_issue_comment(self, comment_id: str) -> None: ...

    def get_pull_request_comments(self, pull_request_id: str) -> list[ActionResult[Comment]]: ...

    def create_pull_request_comment(
        self, pull_request_id: str, body: str
    ) -> ActionResult[Comment]: ...

    def delete_pull_request_comment(self, comment_id: str) -> None: ...

    def get_issue_comment_reactions(
        self, comment_id: str
    ) -> list[ActionResult[ReactionResult]]: ...

    def create_issue_comment_reaction(
        self, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...

    def delete_issue_comment_reaction(self, comment_id: str, reaction_id: str) -> None: ...

    def get_pull_request_comment_reactions(
        self, comment_id: str
    ) -> list[ActionResult[ReactionResult]]: ...

    def create_pull_request_comment_reaction(
        self, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...

    def delete_pull_request_comment_reaction(self, comment_id: str, reaction_id: str) -> None: ...

    def get_issue_reactions(self, issue_id: str) -> list[ActionResult[ReactionResult]]: ...

    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...

    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None: ...

    def get_pull_request_reactions(
        self, pull_request_id: str
    ) -> list[ActionResult[ReactionResult]]: ...

    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]: ...

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None: ...

    def get_branch(self, branch: str) -> ActionResult[GitRef]: ...

    def create_branch(self, branch: str, sha: str) -> ActionResult[GitRef]: ...

    def update_branch(self, branch: str, sha: str, force: bool = False) -> None: ...

    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]: ...

    def get_file_content(self, path: str, ref: str | None = None) -> ActionResult[FileContent]: ...

    def get_commit(self, sha: str) -> ActionResult[Commit]: ...

    def get_commits(
        self, sha: str | None = None, path: str | None = None
    ) -> list[ActionResult[Commit]]: ...

    def compare_commits(self, start_sha: str, end_sha: str) -> ActionResult[CommitComparison]: ...

    def get_tree(self, tree_sha: str, recursive: bool = True) -> ActionResult[GitTree]: ...

    def get_git_commit(self, sha: str) -> ActionResult[GitCommitObject]: ...

    def create_git_tree(
        self, tree: list[InputTreeEntry], base_tree: str | None = None
    ) -> ActionResult[GitTree]: ...

    def create_git_commit(
        self, message: str, tree_sha: str, parent_shas: list[str]
    ) -> ActionResult[GitCommitObject]: ...

    def get_pull_request_files(
        self, pull_request_id: str
    ) -> list[ActionResult[PullRequestFile]]: ...

    def get_pull_request_commits(
        self, pull_request_id: str
    ) -> list[ActionResult[PullRequestCommit]]: ...

    def get_pull_request_diff(self, pull_request_id: str) -> ActionResult[str]: ...

    def get_pull_requests(
        self, state: str = "open", head: str | None = None
    ) -> list[ActionResult[PullRequest]]: ...

    def create_pull_request(
        self,
        title: str,
        body: str,
        head: str,
        base: str,
        draft: bool = False,
    ) -> ActionResult[PullRequest]: ...

    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: str | None = None,
    ) -> ActionResult[PullRequest]: ...

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None: ...

    def create_review_comment(
        self,
        pull_request_id: str,
        body: str,
        commit_sha: str,
        path: str,
        line: int | None = None,
        side: ReviewSide | None = None,
        start_line: int | None = None,
        start_side: ReviewSide | None = None,
    ) -> ActionResult[ReviewComment]: ...

    def create_review(
        self,
        pull_request_id: str,
        commit_sha: str,
        event: str,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ActionResult[Review]: ...

    def create_check_run(
        self,
        name: str,
        head_sha: str,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        external_id: str | None = None,
        started_at: str | None = None,
        completed_at: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]: ...

    def get_check_run(self, check_run_id: str) -> ActionResult[CheckRun]: ...

    def update_check_run(
        self,
        check_run_id: str,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]: ...

    def minimize_comment(self, comment_node_id: str, reason: str) -> None: ...

    def resolve_review_thread(self, thread_node_id: str) -> None: ...
