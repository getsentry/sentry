from typing import Any

from sentry.scm.types import Comment, Provider, PullRequest, Reaction, Referrer, Repository


class BaseTestProvider(Provider):

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool:
        return False

    # Pull request

    def get_pull_request(self, repository: Repository, pull_request_id: str) -> PullRequest:
        raw: dict[str, Any] = {
            "id": 1,
            "title": "Test PR",
            "body": None,
            "head": {"ref": "feature", "sha": "abc123"},
            "base": {"ref": "main", "sha": "def456"},
            "user": {"id": 1, "login": "testuser"},
        }
        return PullRequest(
            id=str(raw["id"]),
            title=raw["title"],
            description=raw["body"],
            head={"name": raw["head"]["ref"], "sha": raw["head"]["sha"]},
            base={"name": raw["base"]["ref"], "sha": raw["base"]["sha"]},
            author={"id": str(raw["user"]["id"]), "username": raw["user"]["login"]},
            raw=raw,
        )

    # Issue comments

    def get_issue_comments(self, repository: Repository, issue_id: str) -> list[Comment]:
        return [
            Comment(
                id="101",
                body="Test comment",
                author={"id": "1", "username": "testuser"},
                created_at="2024-01-01T00:00:00Z",
                updated_at="2024-01-01T00:00:00Z",
                raw={},
            )
        ]

    def create_issue_comment(self, repository: Repository, issue_id: str, body: str) -> None:
        return None

    def delete_issue_comment(self, repository: Repository, comment_id: str) -> None:
        return None

    # Pull request comments

    def get_pull_request_comments(
        self, repository: Repository, pull_request_id: str
    ) -> list[Comment]:
        return [
            Comment(
                id="201",
                body="PR review comment",
                author={"id": "2", "username": "reviewer"},
                created_at="2024-01-02T00:00:00Z",
                updated_at="2024-01-02T00:00:00Z",
                raw={},
            )
        ]

    def create_pull_request_comment(
        self, repository: Repository, pull_request_id: str, body: str
    ) -> None:
        return None

    def delete_pull_request_comment(self, repository: Repository, comment_id: str) -> None:
        return None

    # Comment reactions

    def get_comment_reactions(self, repository: Repository, comment_id: str) -> list[Reaction]:
        return ["+1", "eyes"]

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
        return ["+1", "heart"]

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        return None

    def delete_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        return None
