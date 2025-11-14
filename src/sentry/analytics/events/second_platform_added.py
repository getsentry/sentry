from typing import int
from sentry import analytics


@analytics.eventclass("second_platform.added")
class SecondPlatformAddedEvent(analytics.Event):
    user_id: int
    organization_id: int
    project_id: int
    platform: str | None = None


analytics.register(SecondPlatformAddedEvent)
