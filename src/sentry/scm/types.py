from typing import Literal, Protocol, TypedDict

type ProviderName = str
type ExternalId = str
type Reaction = Literal["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]
type Referrer = Literal["emerge", "shared"]
type RepositoryId = int | tuple[ProviderName, ExternalId]


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

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        """Create a reaction to an issue."""
        ...

    # Examples of how you might implement some of the permutations of issue reaction:

    # def create_comment_reaction(
    #     self, repository: Repository, comment_id: str, reaction: Reaction
    # ) -> None: ...

    # def create_pull_request_reaction(
    #     self, repository: Repository, pull_request_id: str, reaction: Reaction
    # ) -> None: ...

    # def create_pull_request_review_reaction(
    #     self, repository: Repository, review_id: str, reaction: Reaction
    # ) -> None: ...
