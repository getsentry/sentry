from sentry import analytics


class IntegrationSlackChartUnfurl(analytics.Event):
    type = "integrations.slack_chart_unfurl"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("has_unfurl", type=int),
    )


analytics.register(IntegrationSlackChartUnfurl)
