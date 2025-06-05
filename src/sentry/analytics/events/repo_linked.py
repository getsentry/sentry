from sentry import analytics


@analytics.eventclass("repo.linked")
class RepoLinkedEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    organization_id: str
    repository_id: str
    provider: str


analytics.register(RepoLinkedEvent)
