from sentry.scm.types import Comment, Provider, Reaction, Referrer, Repository


class BaseTestProvider(Provider):

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool:
        return False

    # Issue comments

    def get_issue_comments(self, repository: Repository, issue_id: str) -> list[Comment]:
        return []

    def create_issue_comment(self, repository: Repository, issue_id: str, body: str) -> None:
        return None

    def delete_issue_comment(self, repository: Repository, comment_id: str) -> None:
        return None

    # Pull request comments

    def get_pull_request_comments(
        self, repository: Repository, pull_request_id: str
    ) -> list[Comment]:
        return []

    def create_pull_request_comment(
        self, repository: Repository, pull_request_id: str, body: str
    ) -> None:
        return None

    def delete_pull_request_comment(self, repository: Repository, comment_id: str) -> None:
        return None

    # Comment reactions

    def get_comment_reactions(self, repository: Repository, comment_id: str) -> list[Reaction]:
        return []

    def create_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None:
        return None

    def delete_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None:
        return None

    # Issue reactions

    def get_issue_reactions(self, repository: Repository, issue_id: str) -> list[Reaction]:
        return []

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        return None

    def delete_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        return None
