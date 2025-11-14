from typing import int
from sentry import analytics


@analytics.eventclass("first_flag.sent")
class FirstFlagSentEvent(analytics.Event):
    organization_id: int
    project_id: int
    platform: str | None = None


analytics.register(FirstFlagSentEvent)
