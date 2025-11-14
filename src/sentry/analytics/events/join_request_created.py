from typing import int
from sentry import analytics


@analytics.eventclass("join_request.created")
class JoinRequestCreatedEvent(analytics.Event):
    member_id: int
    organization_id: int
    referrer: str | None = None


analytics.register(JoinRequestCreatedEvent)
