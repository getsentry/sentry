from typing import int
from sentry import analytics


@analytics.eventclass("repo.linked")
class RepoLinkedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int
    organization_id: int
    repository_id: int
    provider: str


analytics.register(RepoLinkedEvent)
