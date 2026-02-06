from typing import Any, Literal, Protocol, TypedDict

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
    body: str
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


class IssueReaction(TypedDict):
    """Provider-agnostic representation of a reaction on an issue."""

    id: str
    content: Reaction
    author: Author | None


class PullRequestBranch(TypedDict):
    """A branch reference within a pull request (head or base)."""

    sha: str


class PullRequest(TypedDict):
    """Provider-agnostic representation of a pull request."""

    head: PullRequestBranch


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
    status: str


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

    def get_comment_reactions(
        self, repository: Repository, comment_id: str
    ) -> dict[Reaction, int]: ...

    def create_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None: ...

    def delete_comment_reaction(
        self, repository: Repository, comment_id: str, reaction_id: str
    ) -> None: ...

    def get_issue_reactions(self, repository: Repository, issue_id: str) -> list[IssueReaction]: ...

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None: ...

    def delete_issue_reaction(
        self, repository: Repository, issue_id: str, reaction_id: str
    ) -> None: ...
