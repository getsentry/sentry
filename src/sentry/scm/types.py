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

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool: ...

    # Issues

    # def get_issue_reactions(self, repository: Repository, issue_id: str) -> list[IssueReaction]: ...

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None: ...

    # def delete_issue_reaction(
    #     self, repository: Repository, issue_id: str, reaction_id: str
    # ) -> None: ...

    # def get_issue_comment_reactions(
    #     self, repository: Repository, comment_id: str
    # ) -> list[CommentReaction]: ...

    # def create_issue_comment_reaction(
    #     self, repository: Repository, comment_id: str, reaction: Reaction
    # ) -> None: ...
