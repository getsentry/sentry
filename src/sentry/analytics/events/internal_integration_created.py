from typing import int
from sentry import analytics


@analytics.eventclass("internal_integration.created")
class InternalIntegrationCreatedEvent(analytics.Event):
    user_id: int
    organization_id: int
    sentry_app: str


analytics.register(InternalIntegrationCreatedEvent)
