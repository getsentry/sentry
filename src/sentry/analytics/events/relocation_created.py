from typing import int
from sentry import analytics


@analytics.eventclass("relocation.created")
class RelocationCreatedEvent(analytics.Event):
    creator_id: int
    owner_id: int
    uuid: str


analytics.register(RelocationCreatedEvent)
