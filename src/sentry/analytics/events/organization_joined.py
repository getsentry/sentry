from typing import int
from sentry import analytics


@analytics.eventclass("organization.joined")
class OrganizationJoinedEvent(analytics.Event):
    user_id: int
    organization_id: int


analytics.register(OrganizationJoinedEvent)
