from sentry import analytics


@analytics.eventclass("release.created")
class ReleaseCreatedEvent(analytics.Event):
    user_id: str | None = None
    organization_id: str
    project_ids: list[int]
    user_agent: str | None = None
    auth_type: str | None = None
    created_status: str


analytics.register(ReleaseCreatedEvent)
