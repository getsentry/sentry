from sentry import analytics


@analytics.eventclass("release.created")
class ReleaseCreatedEvent(analytics.Event):
    user_id: int | None = None
    organization_id: int
    project_ids: list[int]
    user_agent: str | None = None
    auth_type: str | None = None
    created_status: int


analytics.register(ReleaseCreatedEvent)
