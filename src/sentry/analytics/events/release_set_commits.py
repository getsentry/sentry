from sentry import analytics


@analytics.eventclass("release.set_commits_local")
class ReleaseSetCommitsLocalEvent(analytics.Event):
    user_id: str | None = None
    organization_id: str
    project_ids: list[int] | None
    user_agent: str | None = None


analytics.register(ReleaseSetCommitsLocalEvent)
