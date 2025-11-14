from typing import int
from sentry import analytics


@analytics.eventclass("release.set_commits_local")
class ReleaseSetCommitsLocalEvent(analytics.Event):
    user_id: int | None = None
    organization_id: int
    project_ids: list[int] | None
    user_agent: str | None = None


analytics.register(ReleaseSetCommitsLocalEvent)
