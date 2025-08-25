from sentry import analytics
from sentry.analytics import Event, eventclass


@eventclass("organization.removed")
class OrganizationRemoved(Event):
    organization_id: int
    slug: str
    user_id: int | None = None
    deletion_request_datetime: str | None = None
    deletion_datetime: str | None = None


analytics.register(OrganizationRemoved)
