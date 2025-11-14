from typing import int
from sentry import analytics


@analytics.eventclass("organization.created")
class OrganizationCreatedEvent(analytics.Event):
    id: int
    name: str
    slug: str
    actor_id: int | None = None


analytics.register(OrganizationCreatedEvent)
