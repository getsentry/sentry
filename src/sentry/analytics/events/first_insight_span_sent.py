from typing import int
from sentry import analytics


@analytics.eventclass("first_insight_span.sent")
class FirstInsightSpanSentEvent(analytics.Event):
    organization_id: int
    user_id: int | None
    project_id: int
    module: str
    platform: str | None = None


analytics.register(FirstInsightSpanSentEvent)
