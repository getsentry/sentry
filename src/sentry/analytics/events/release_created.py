from sentry import analytics
from sentry.analytics import Event, eventclass


@eventclass("release.created")
class ReleaseCreatedEvent(Event):
    user_id: int | None = None
    organization_id: int
    project_ids: list[int]
    user_agent: str | None = None
    auth_type: str | None = None
    created_status: str


analytics.register(ReleaseCreatedEvent)
