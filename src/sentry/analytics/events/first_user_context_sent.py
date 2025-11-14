from typing import int
from sentry import analytics


@analytics.eventclass("first_user_context.sent")
class FirstUserContextSentEvent(analytics.Event):
    user_id: int
    organization_id: int
    project_id: int


analytics.register(FirstUserContextSentEvent)
