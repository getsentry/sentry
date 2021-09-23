from sentry import analytics


class SlackIntegrationAssign(analytics.Event):  # type: ignore
    type = "integrations.slack.assign"

    attributes = (analytics.Attribute("actor_id", required=False),)


class SlackIntegrationStatus(analytics.Event):  # type: ignore
    type = "integrations.slack.status"

    attributes = (
        analytics.Attribute("status"),
        analytics.Attribute("resolve_type", required=False),
        analytics.Attribute("actor_id", required=False),
    )


class SlackIntegrationNotificationSent(analytics.Event):  # type: ignore
    type = "integrations.slack.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("category"),
        analytics.Attribute("actor_id"),
    )


class IntegrationSlackChartUnfurl(analytics.Event):
    type = "integrations.slack.chart_unfurl"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("has_unfurl", type=int),
    )


class IntegrationSlackLinkIdentity(analytics.Event):
    type = "integrations.slack.link_identity"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("method"),
    )


analytics.register(SlackIntegrationAssign)
analytics.register(SlackIntegrationNotificationSent)
analytics.register(SlackIntegrationStatus)
analytics.register(IntegrationSlackChartUnfurl)
analytics.register(IntegrationSlackLinkIdentity)
