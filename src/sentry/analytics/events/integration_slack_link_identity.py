from sentry import analytics


class IntegrationSlackLinkIdentity(analytics.Event):
    type = "integrations.slack.link_identity"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("mode"),
    )


analytics.register(IntegrationSlackLinkIdentity)
