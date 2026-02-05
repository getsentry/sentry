from typing import Any, Literal, Protocol, TypedDict

type ProviderName = str
type ExternalId = str
type Reaction = Literal["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]
type Referrer = Literal["emerge", "shared"]
type RepositoryId = int | tuple[ProviderName, ExternalId]


class Author(TypedDict):
    id: str
    username: str


class Comment(TypedDict):
    id: str
    body: str
    author: Author
    created_at: str
    updated_at: str
    provider: ProviderName
    raw: dict[str, Any]


class PullRequestBranch(TypedDict):
    name: str
    sha: str


class PullRequest(TypedDict):
    id: str
    title: str
    description: str | None
    head: PullRequestBranch
    base: PullRequestBranch
    author: Author
    provider: ProviderName
    raw: dict[str, Any]


class Repository(TypedDict):
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

    def get_pull_request(self, repository: Repository, pull_request_id: str) -> PullRequest: ...

    def get_issue_comments(self, repository: Repository, issue_id: str) -> list[Comment]: ...

    def create_issue_comment(self, repository: Repository, issue_id: str, body: str) -> None: ...

    def delete_issue_comment(self, repository: Repository, comment_id: str) -> None: ...

    def get_pull_request_comments(
        self, repository: Repository, pull_request_id: str
    ) -> list[Comment]: ...

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

    def get_issue_reactions(self, repository: Repository, issue_id: str) -> list[Reaction]: ...

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None: ...

    def delete_issue_reaction(
        self, repository: Repository, issue_id: str, reaction_id: str
    ) -> None: ...
