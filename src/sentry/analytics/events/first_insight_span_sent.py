from sentry import analytics


class FirstInsightSpanSentEvent(analytics.Event):
    type = "first_insight_span.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("module"),
        analytics.Attribute("platform", required=False),
    )


analytics.register(FirstInsightSpanSentEvent)
