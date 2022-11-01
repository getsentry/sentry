from sentry import analytics


class FirstReplaySentEvent(analytics.Event):
    type = "first_replay.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
        analytics.Attribute("user_id", required=False),
    )


analytics.register(FirstReplaySentEvent)
