from typing import int
from sentry import analytics


@analytics.eventclass("first_profile.sent")
class FirstProfileSentEvent(analytics.Event):
    organization_id: int
    project_id: int
    platform: str | None = None
    user_id: int | None = None


analytics.register(FirstProfileSentEvent)
