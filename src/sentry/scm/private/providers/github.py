from sentry.integrations.github.client import GitHubApiClient, GitHubReaction
from sentry.scm.types import Provider, Reaction, Referrer, Repository

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

    # TODO: Define contract for issue reaction response (can be None)
    def get_issue_reactions(self, repository: Repository, issue_id: str) -> list[None]:
        # TODO: Catch exceptions and re-raise `raise SCMProviderException from e`
        self.client.get_issue_reactions(repository["name"], issue_id)
        return []

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        # TODO: Catch exceptions and re-raise `raise SCMProviderException from e`
        self.client.create_issue_reaction(repository["name"], issue_id, REACTION_MAP[reaction])
