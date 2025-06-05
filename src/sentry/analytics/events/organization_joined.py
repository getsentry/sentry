from sentry import analytics


@analytics.eventclass("organization.joined")
class OrganizationJoinedEvent(analytics.Event):
    user_id: str
    organization_id: str


analytics.register(OrganizationJoinedEvent)
