from sentry import analytics


@analytics.eventclass("release.get_previous_commits")
class ReleaseGetPreviousCommitsEvent(analytics.Event):
    user_id: str | None = None
    organization_id: str
    project_ids: list[int]
    user_agent: str | None = None


analytics.register(ReleaseGetPreviousCommitsEvent)
