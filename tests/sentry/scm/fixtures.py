from sentry.scm.types import Provider, Reaction, Referrer, Repository


class BaseTestProvider(Provider):

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool:
        return False

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        return None
