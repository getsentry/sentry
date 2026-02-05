from typing import Any

from sentry.integrations.github.client import GitHubApiClient, GitHubReaction
from sentry.scm.errors import SCMProviderException, SCMUnhandledException
from sentry.scm.types import Comment, Provider, PullRequest, Reaction, Referrer, Repository
from sentry.shared_integrations.exceptions import ApiError

REACTION_MAP = {
    "+1": GitHubReaction.PLUS_ONE,
    "-1": GitHubReaction.MINUS_ONE,
    "laugh": GitHubReaction.LAUGH,
    "confused": GitHubReaction.CONFUSED,
    "heart": GitHubReaction.HEART,
    "hooray": GitHubReaction.HOORAY,
    "rocket": GitHubReaction.ROCKET,
    "eyes": GitHubReaction.EYES,
}


# TODO: Rate-limits are dynamic per org. Some will have higher limits. We need to dynamically
#       configure the shared pool. The absolute allocation amount for explicit referrers can
#       remain unchanged.
REFERRER_ALLOCATION: dict[Referrer, int] = {"shared": 4500, "emerge": 500}


def _transform_comment(raw: dict[str, Any]) -> Comment:
    return Comment(
        id=str(raw["id"]),
        body=raw["body"],
        author={"id": str(raw["user"]["id"]), "username": raw["user"]["login"]},
        provider="github",
        raw=raw,
    )


def _transform_pull_request(raw: dict[str, Any]) -> PullRequest:
    return PullRequest(
        id=str(raw["id"]),
        title=raw["title"],
        description=raw.get("body"),
        head={"name": raw["head"]["ref"], "sha": raw["head"]["sha"]},
        base={"name": raw["base"]["ref"], "sha": raw["base"]["sha"]},
        author={"id": str(raw["user"]["id"]), "username": raw["user"]["login"]},
        provider="github",
        raw=raw,
    )


class GitHubProvider(Provider):

    def __init__(self, client: GitHubApiClient) -> None:
        self.client = client

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool:
        from sentry.scm.helpers import is_rate_limited_with_allocation_policy

        return is_rate_limited_with_allocation_policy(
            organization_id,
            referrer,
            provider="github",
            window=3600,
            allocation_policy=REFERRER_ALLOCATION,
        )

    def get_issue_comments(self, repository: Repository, issue_id: str) -> list[Comment]:
        try:
            raw_comments = self.client.get_issue_comments(repository["name"], issue_id)
            return [_transform_comment(c) for c in raw_comments]
        except ApiError as e:
            raise SCMProviderException from e
        except KeyError as e:
            raise SCMUnhandledException from e

    def create_issue_comment(self, repository: Repository, issue_id: str, body: str) -> None:
        try:
            self.client.create_comment(repository["name"], issue_id, {"body": body})
        except ApiError as e:
            raise SCMProviderException from e

    def delete_issue_comment(self, repository: Repository, comment_id: str) -> None:
        try:
            self.client.delete_issue_comment(repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException from e

    def get_pull_request(self, repository: Repository, pull_request_id: str) -> PullRequest:
        try:
            raw = self.client.get_pull_request(repository["name"], pull_request_id)
            return _transform_pull_request(raw)
        except ApiError as e:
            raise SCMProviderException from e
        except KeyError as e:
            raise SCMUnhandledException from e

    def get_pull_request_comments(
        self, repository: Repository, pull_request_id: str
    ) -> list[Comment]:
        try:
            raw_comments = self.client.get_pull_request_comments(
                repository["name"], pull_request_id
            )
            return [_transform_comment(c) for c in raw_comments]
        except ApiError as e:
            raise SCMProviderException from e
        except KeyError as e:
            raise SCMUnhandledException from e

    def create_pull_request_comment(
        self, repository: Repository, pull_request_id: str, body: str
    ) -> None:
        try:
            self.client.create_comment(repository["name"], pull_request_id, {"body": body})
        except ApiError as e:
            raise SCMProviderException from e

    def delete_pull_request_comment(self, repository: Repository, comment_id: str) -> None:
        try:
            self.client.delete_issue_comment(repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException from e

    def get_comment_reactions(self, repository: Repository, comment_id: str) -> dict[Reaction, int]:
        try:
            return self.client.get_comment_reactions(repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException from e

    def create_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None:
        try:
            self.client.create_comment_reaction(
                repository["name"], comment_id, REACTION_MAP[reaction]
            )
        except ApiError as e:
            raise SCMProviderException from e
        except KeyError as e:
            raise SCMUnhandledException from e

    def delete_comment_reaction(
        self, repository: Repository, comment_id: str, reaction_id: str
    ) -> None:
        try:
            self.client.delete_comment_reaction(repository["name"], comment_id, reaction_id)
        except ApiError as e:
            raise SCMProviderException from e

    def get_issue_reactions(self, repository: Repository, issue_id: str) -> list[Reaction]:
        try:
            return self.client.get_issue_reactions(repository["name"], issue_id)
        except ApiError as e:
            raise SCMProviderException from e

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        try:
            self.client.create_issue_reaction(repository["name"], issue_id, REACTION_MAP[reaction])
        except ApiError as e:
            raise SCMProviderException from e
        except KeyError as e:
            raise SCMUnhandledException from e

    def delete_issue_reaction(
        self, repository: Repository, issue_id: str, reaction_id: str
    ) -> None:
        try:
            self.client.delete_issue_reaction(repository["name"], issue_id, reaction_id)
        except ApiError as e:
            raise SCMProviderException from e
