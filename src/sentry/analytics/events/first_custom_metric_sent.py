from sentry import analytics


class FirstCustomMetricSent(analytics.Event):
    type = "first_custom_metric.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
        analytics.Attribute("user_id", required=False),
    )


analytics.register(FirstCustomMetricSent)
