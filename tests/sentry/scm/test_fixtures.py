from typing import Any

from sentry.integrations.github.client import GitHubReaction
from sentry.scm.types import Comment, Provider, PullRequest, Reaction, Referrer, Repository
from sentry.shared_integrations.exceptions import ApiError


def make_github_comment(
    comment_id: int = 1,
    body: str = "Test comment",
    user_id: int = 123,
    username: str = "testuser",
) -> dict[str, Any]:
    """Factory for GitHub comment API responses."""
    return {
        "id": comment_id,
        "body": body,
        "user": {"id": user_id, "login": username},
        "created_at": "2026-02-04T10:00:00Z",
        "updated_at": "2026-02-04T10:00:00Z",
    }


def make_github_pull_request(
    pr_id: int = 42,
    title: str = "Test PR",
    body: str | None = "PR description",
    head_sha: str = "abc123",
    base_sha: str = "def456",
    head_ref: str = "feature-branch",
    base_ref: str = "main",
    user_id: int = 123,
    username: str = "testuser",
) -> dict[str, Any]:
    """Factory for GitHub PR API responses."""
    return {
        "id": pr_id,
        "title": title,
        "body": body,
        "head": {"ref": head_ref, "sha": head_sha},
        "base": {"ref": base_ref, "sha": base_sha},
        "user": {"id": user_id, "login": username},
    }


def make_github_reaction(
    reaction_id: int = 1,
    content: str = "eyes",
    user_id: int = 123,
    username: str = "testuser",
) -> dict[str, Any]:
    """Factory for GitHub reaction API responses."""
    return {
        "id": reaction_id,
        "content": content,
        "user": {"id": user_id, "login": username},
    }


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
        self, repository: Repository, comment_id: str, reaction_id: str
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
        self, repository: Repository, issue_id: str, reaction_id: str
    ) -> None:
        return None


class FakeGitHubApiClient:
    """
    A fake GitHubApiClient for testing GitHubProvider without HTTP mocking.

    Configure responses by setting the corresponding attributes before calling
    provider methods. Use `raise_api_error` to simulate API failures.
    """

    def __init__(self) -> None:
        self.issue_comments: list[dict[str, Any]] = []
        self.pull_request_comments: list[dict[str, Any]] = []
        self.pull_request_data: dict[str, Any] | None = None
        self.comment_reactions: list[dict[str, Any]] = []
        self.issue_reactions: list[dict[str, Any]] = []

        self.raise_api_error: bool = False
        self.calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []

    def _record_call(self, method: str, *args: Any, **kwargs: Any) -> None:
        self.calls.append((method, args, kwargs))

    def _maybe_raise(self) -> None:
        if self.raise_api_error:
            raise ApiError("Fake API error")

    def get_issue_comments(self, repo: str, issue_number: str) -> list[dict[str, Any]]:
        self._record_call("get_issue_comments", repo, issue_number)
        self._maybe_raise()
        return self.issue_comments

    def get_pull_request(self, repo: str, pull_number: str) -> dict[str, Any]:
        self._record_call("get_pull_request", repo, pull_number)
        self._maybe_raise()
        if self.pull_request_data is None:
            return make_github_pull_request()
        return self.pull_request_data

    def get_pull_request_comments(self, repo: str, pull_number: str) -> list[dict[str, Any]]:
        self._record_call("get_pull_request_comments", repo, pull_number)
        self._maybe_raise()
        return self.pull_request_comments

    def create_comment(self, repo: str, issue_id: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_comment", repo, issue_id, data)
        self._maybe_raise()
        return make_github_comment(body=data.get("body", ""))

    def delete(self, path: str) -> None:
        self._record_call("delete", path)
        self._maybe_raise()

    def get_comment_reactions(self, repo: str, comment_id: str) -> list[dict[str, Any]]:
        self._record_call("get_comment_reactions", repo, comment_id)
        self._maybe_raise()
        return self.comment_reactions

    def create_comment_reaction(
        self, repo: str, comment_id: str, reaction: GitHubReaction
    ) -> dict[str, Any]:
        self._record_call("create_comment_reaction", repo, comment_id, reaction)
        self._maybe_raise()
        return make_github_reaction(content=reaction.value)

    def get_issue_reactions(self, repo: str, issue_number: str) -> list[dict[str, Any]]:
        self._record_call("get_issue_reactions", repo, issue_number)
        self._maybe_raise()
        return self.issue_reactions

    def create_issue_reaction(
        self, repo: str, issue_number: str, reaction: GitHubReaction
    ) -> dict[str, Any]:
        self._record_call("create_issue_reaction", repo, issue_number, reaction)
        self._maybe_raise()
        return make_github_reaction(content=reaction.value)

    def delete_issue_reaction(self, repo: str, issue_number: str, reaction_id: str) -> None:
        self._record_call("delete_issue_reaction", repo, issue_number, reaction_id)
        self._maybe_raise()
