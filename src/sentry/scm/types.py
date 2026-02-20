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


class ActionResult[T](TypedDict):
    """Wraps a PullRequest with provider metadata and the original API response.

    ActionResult types pair a normalized domain object with the provider name
    and the raw API payload. This lets callers work with a stable interface
    while still having access to provider-specific fields when needed.
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
    status: str
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


class GitCommitTree(TypedDict):
    sha: str


class GitCommitObject(TypedDict):
    sha: str
    tree: GitCommitTree
    message: str


class PullRequestFile(TypedDict):
    filename: str
    status: str
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
    side: str  # "LEFT" or "RIGHT"
    start_line: int
    start_side: str  # "LEFT" or "RIGHT"


class ReviewComment(TypedDict):
    """Provider-agnostic representation of a review comment."""

    id: int
    html_url: str
    path: str
    body: str


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

    def create_issue_comment(self, issue_id: str, body: str) -> None: ...

    def delete_issue_comment(self, comment_id: str) -> None: ...

    def get_pull_request_comments(self, pull_request_id: str) -> list[ActionResult[Comment]]: ...

    def create_pull_request_comment(self, pull_request_id: str, body: str) -> None: ...

    def delete_pull_request_comment(self, comment_id: str) -> None: ...

    def get_issue_comment_reactions(self, comment_id: str) -> list[ReactionResult]: ...

    def create_issue_comment_reaction(self, comment_id: str, reaction: Reaction) -> None: ...

    def delete_issue_comment_reaction(self, comment_id: str, reaction_id: str) -> None: ...

    def get_pull_request_comment_reactions(self, comment_id: str) -> list[ReactionResult]: ...

    def create_pull_request_comment_reaction(self, comment_id: str, reaction: Reaction) -> None: ...

    def delete_pull_request_comment_reaction(self, comment_id: str, reaction_id: str) -> None: ...

    def get_issue_reactions(self, issue_id: str) -> list[ReactionResult]: ...

    def create_issue_reaction(self, issue_id: str, reaction: Reaction) -> None: ...

    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None: ...

    def get_pull_request_reactions(self, pull_request_id: str) -> list[ReactionResult]: ...

    def create_pull_request_reaction(self, pull_request_id: str, reaction: Reaction) -> None: ...

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
    ) -> ActionResult[list[PullRequestFile]]: ...

    def get_pull_request_commits(
        self, pull_request_id: str
    ) -> ActionResult[list[PullRequestCommit]]: ...

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
        side: str | None = None,
        start_line: int | None = None,
        start_side: str | None = None,
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
        status: str | None = None,
        conclusion: str | None = None,
        external_id: str | None = None,
        started_at: str | None = None,
        completed_at: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]: ...

    def get_check_run(self, check_run_id: str) -> ActionResult[CheckRun]: ...

    def update_check_run(
        self,
        check_run_id: str,
        status: str | None = None,
        conclusion: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]: ...

    def minimize_comment(self, comment_node_id: str, reason: str) -> None: ...

    def resolve_review_thread(self, thread_node_id: str) -> None: ...
