from sentry import analytics


class SlackIntegrationAssign(analytics.Event):
    type = "integrations.slack.assign"

    attributes = (analytics.Attribute("actor_id", required=False),)


class SlackIntegrationStatus(analytics.Event):
    type = "integrations.slack.status"

    attributes = (
        analytics.Attribute("status"),
        analytics.Attribute("resolve_type", required=False),
        analytics.Attribute("actor_id", required=False),
    )


analytics.register(SlackIntegrationAssign)
analytics.register(SlackIntegrationStatus)
