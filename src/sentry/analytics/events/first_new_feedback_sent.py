from typing import int
from sentry import analytics


@analytics.eventclass("first_new_feedback.sent")
class FirstNewFeedbackSentEvent(analytics.Event):
    organization_id: int
    project_id: int
    platform: str | None = None
    user_id: int | None = None


analytics.register(FirstNewFeedbackSentEvent)
