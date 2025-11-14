from typing import int
from sentry import analytics


@analytics.eventclass("join_request.link_viewed")
class JoinRequestLinkViewedEvent(analytics.Event):
    organization_id: int


analytics.register(JoinRequestLinkViewedEvent)
