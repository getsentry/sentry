from sentry import analytics


class FirstFlagSentEvent(analytics.Event):
    type = "first_flag.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
    )


analytics.register(FirstFlagSentEvent)
