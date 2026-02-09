from typing import Any, Literal, Protocol, Required, TypedDict

type ProviderName = str
type ExternalId = str
# Normalized reaction identifiers shared across all SCM providers.
type Reaction = Literal["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]
# Identifies the caller so providers can apply per-referrer rate-limit policies.
type Referrer = Literal["emerge", "shared"]
# A repository can be identified by its internal DB id or by a (provider, external_id) pair.
type RepositoryId = int | tuple[ProviderName, ExternalId]


class Author(TypedDict):
    """Normalized author identity returned by all SCM providers."""

    id: str
    username: str


class Comment(TypedDict):
    """Provider-agnostic representation of an issue or pull-request comment."""

    id: str
    body: str | None
    author: Author | None


class CommentActionResult(TypedDict):
    """Wraps a Comment with provider metadata and the original API response.

    ActionResult types pair a normalized domain object with the provider name
    and the raw API payload. This lets callers work with a stable interface
    while still having access to provider-specific fields when needed.
    """

    comment: Comment
    provider: ProviderName
    raw: dict[str, Any]


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

    id: int
    number: int
    title: str
    body: str | None
    state: str
    merged: bool
    url: str
    html_url: str
    head: PullRequestBranch
    base: PullRequestBranch


class PullRequestActionResult(TypedDict):
    """Wraps a PullRequest with provider metadata and the original API response.

    ActionResult types pair a normalized domain object with the provider name
    and the raw API payload. This lets callers work with a stable interface
    while still having access to provider-specific fields when needed.
    """

    pull_request: PullRequest
    provider: ProviderName
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


class GitRefActionResult(TypedDict):
    git_ref: GitRef
    provider: ProviderName
    raw: dict[str, Any]


class FileContent(TypedDict):
    path: str
    sha: str
    content: str  # base64-encoded
    encoding: str
    size: int


class FileContentActionResult(TypedDict):
    file_content: FileContent
    provider: ProviderName
    raw: dict[str, Any]


class CommitAuthor(TypedDict):
    name: str
    email: str
    date: str


class CommitFile(TypedDict):
    filename: str
    status: str
    patch: str | None


class Commit(TypedDict):
    sha: str
    message: str
    author: CommitAuthor | None
    files: list[CommitFile]


class CommitActionResult(TypedDict):
    commit: Commit
    provider: ProviderName
    raw: dict[str, Any]


class CommitComparison(TypedDict):
    ahead_by: int
    behind_by: int


class CommitComparisonActionResult(TypedDict):
    comparison: CommitComparison
    provider: ProviderName
    raw: dict[str, Any]


class TreeEntry(TypedDict):
    path: str
    mode: str
    type: str
    sha: str
    size: int | None


class InputTreeEntry(TypedDict):
    path: str
    mode: str
    type: str
    sha: str | None  # None for deletions


class GitTree(TypedDict):
    tree: list[TreeEntry]
    truncated: bool


class GitTreeActionResult(TypedDict):
    git_tree: GitTree
    provider: ProviderName
    raw: dict[str, Any]


class GitCommitTree(TypedDict):
    sha: str


class GitCommitObject(TypedDict):
    sha: str
    tree: GitCommitTree
    message: str


class GitCommitObjectActionResult(TypedDict):
    git_commit: GitCommitObject
    provider: ProviderName
    raw: dict[str, Any]


class PullRequestFile(TypedDict):
    filename: str
    status: str
    patch: str | None
    changes: int
    sha: str
    previous_filename: str | None


class PullRequestFileActionResult(TypedDict):
    files: list[PullRequestFile]
    provider: ProviderName
    raw: list[dict[str, Any]]


class PullRequestCommit(TypedDict):
    sha: str
    message: str
    author: CommitAuthor | None


class PullRequestCommitActionResult(TypedDict):
    commits: list[PullRequestCommit]
    provider: ProviderName
    raw: list[dict[str, Any]]


class PullRequestDiffActionResult(TypedDict):
    diff: str
    provider: ProviderName


class ReviewCommentInput(TypedDict, total=False):
    """Input for an inline comment within a batch review."""

    path: Required[str]
    body: Required[str]
    line: int
    side: str  # "LEFT" or "RIGHT"
    start_line: int
    start_side: str  # "LEFT" or "RIGHT"


class ReviewComment(TypedDict):
    """Provider-agnostic representation of a review comment."""

    id: int
    html_url: str
    path: str
    body: str


class ReviewCommentActionResult(TypedDict):
    review_comment: ReviewComment
    provider: ProviderName
    raw: dict[str, Any]


class Review(TypedDict):
    """Provider-agnostic representation of a pull request review."""

    id: int
    html_url: str


class ReviewActionResult(TypedDict):
    review: Review
    provider: ProviderName
    raw: dict[str, Any]


class CheckRunOutput(TypedDict, total=False):
    """Output annotation for a check run."""

    title: Required[str]
    summary: Required[str]
    text: str


class CheckRun(TypedDict):
    """Provider-agnostic representation of a check run."""

    id: int
    name: str
    status: str  # "queued", "in_progress", "completed"
    conclusion: str | None  # "success", "failure", "neutral", etc.
    html_url: str


class CheckRunActionResult(TypedDict):
    check_run: CheckRun
    provider: ProviderName
    raw: dict[str, Any]


class Provider(Protocol):
    """
    Providers abstract over an integration. They map generic commands to service-provider specific
    commands and they map the results of those commands to generic result-types.

    Providers necessarily offer a larger API surface than what is available in an integration. Some
    methods may be duplicates in some providers. This is intentional. Providers capture programmer
    intent and translate it into a concrete interface. Therefore, providers provide a large range
    of behaviors which may or may not be explicitly defined on a service-provider.
    """

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool: ...

    def get_pull_request(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestActionResult: ...

    def get_issue_comments(
        self, repository: Repository, issue_id: str
    ) -> list[CommentActionResult]: ...

    def create_issue_comment(self, repository: Repository, issue_id: str, body: str) -> None: ...

    def delete_issue_comment(self, repository: Repository, comment_id: str) -> None: ...

    def get_pull_request_comments(
        self, repository: Repository, pull_request_id: str
    ) -> list[CommentActionResult]: ...

    def create_pull_request_comment(
        self, repository: Repository, pull_request_id: str, body: str
    ) -> None: ...

    def delete_pull_request_comment(self, repository: Repository, comment_id: str) -> None: ...

    def get_issue_comment_reactions(
        self, repository: Repository, comment_id: str
    ) -> list[ReactionResult]: ...

    def create_issue_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None: ...

    def delete_issue_comment_reaction(
        self, repository: Repository, comment_id: str, reaction_id: str
    ) -> None: ...

    def get_pull_request_comment_reactions(
        self, repository: Repository, comment_id: str
    ) -> list[ReactionResult]: ...

    def create_pull_request_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None: ...

    def delete_pull_request_comment_reaction(
        self, repository: Repository, comment_id: str, reaction_id: str
    ) -> None: ...

    def get_issue_reactions(
        self, repository: Repository, issue_id: str
    ) -> list[ReactionResult]: ...

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None: ...

    def delete_issue_reaction(
        self, repository: Repository, issue_id: str, reaction_id: str
    ) -> None: ...

    def get_pull_request_reactions(
        self, repository: Repository, pull_request_id: str
    ) -> list[ReactionResult]: ...

    def create_pull_request_reaction(
        self, repository: Repository, pull_request_id: str, reaction: Reaction
    ) -> None: ...

    def delete_pull_request_reaction(
        self, repository: Repository, pull_request_id: str, reaction_id: str
    ) -> None: ...

    # Branch operations

    def get_branch(self, repository: Repository, branch: str) -> GitRefActionResult: ...

    def create_branch(
        self, repository: Repository, branch: str, sha: str
    ) -> GitRefActionResult: ...

    def update_branch(
        self, repository: Repository, branch: str, sha: str, force: bool = False
    ) -> None: ...

    # File content operations

    def get_file_content(
        self, repository: Repository, path: str, ref: str | None = None
    ) -> FileContentActionResult: ...

    # Commit operations

    def get_commit(self, repository: Repository, sha: str) -> CommitActionResult: ...

    def get_commits(self, repository: Repository) -> list[CommitActionResult]: ...

    def compare_commits(
        self, repository: Repository, start_sha: str, end_sha: str
    ) -> CommitComparisonActionResult: ...

    # Git data operations

    def get_tree(self, repository: Repository, tree_sha: str) -> GitTreeActionResult: ...

    def get_git_commit(self, repository: Repository, sha: str) -> GitCommitObjectActionResult: ...

    def create_git_tree(
        self,
        repository: Repository,
        tree: list[InputTreeEntry],
        *,
        base_tree: str | None = None,
    ) -> GitTreeActionResult: ...

    def create_git_commit(
        self,
        repository: Repository,
        message: str,
        tree_sha: str,
        parent_shas: list[str],
    ) -> GitCommitObjectActionResult: ...

    # Expanded pull request operations

    def get_pull_request_files(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestFileActionResult: ...

    def get_pull_request_commits(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestCommitActionResult: ...

    def get_pull_request_diff(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestDiffActionResult: ...

    def list_pull_requests(
        self, repository: Repository, state: str = "open", head: str | None = None
    ) -> list[PullRequestActionResult]: ...

    def create_pull_request(
        self,
        repository: Repository,
        title: str,
        body: str,
        head: str,
        base: str,
        *,
        draft: bool = False,
    ) -> PullRequestActionResult: ...

    def update_pull_request(
        self,
        repository: Repository,
        pull_request_id: str,
        *,
        title: str | None = None,
        body: str | None = None,
        state: str | None = None,
    ) -> PullRequestActionResult: ...

    def request_review(
        self, repository: Repository, pull_request_id: str, reviewers: list[str]
    ) -> None: ...

    # Review operations

    def create_review_comment(
        self,
        repository: Repository,
        pull_request_id: str,
        body: str,
        commit_sha: str,
        path: str,
        *,
        line: int | None = None,
        side: str | None = None,
        start_line: int | None = None,
        start_side: str | None = None,
    ) -> ReviewCommentActionResult: ...

    def create_review(
        self,
        repository: Repository,
        pull_request_id: str,
        commit_sha: str,
        event: str,
        comments: list[ReviewCommentInput],
        *,
        body: str | None = None,
    ) -> ReviewActionResult: ...

    # Check run operations

    def create_check_run(
        self,
        repository: Repository,
        name: str,
        head_sha: str,
        *,
        status: str | None = None,
        conclusion: str | None = None,
        external_id: str | None = None,
        started_at: str | None = None,
        completed_at: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> CheckRunActionResult: ...

    def get_check_run(
        self,
        repository: Repository,
        check_run_id: str,
    ) -> CheckRunActionResult: ...

    def update_check_run(
        self,
        repository: Repository,
        check_run_id: str,
        *,
        status: str | None = None,
        conclusion: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> CheckRunActionResult: ...
