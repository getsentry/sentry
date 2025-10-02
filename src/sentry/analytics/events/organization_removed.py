from sentry import analytics


@analytics.eventclass("organization.removed")
class OrganizationRemoved(analytics.Event):
    organization_id: int
    slug: str
    user_id: int | None = None
    deletion_request_datetime: str | None = None
    deletion_datetime: str | None = None


analytics.register(OrganizationRemoved)
