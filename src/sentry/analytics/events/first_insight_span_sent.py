from sentry import analytics


@analytics.eventclass("first_insight_span.sent")
class FirstInsightSpanSentEvent(analytics.Event):
    organization_id: str
    user_id: int | None
    project_id: str
    module: str
    platform: str | None = None


analytics.register(FirstInsightSpanSentEvent)
