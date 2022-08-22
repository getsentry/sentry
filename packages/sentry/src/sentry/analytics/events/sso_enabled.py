from sentry import analytics


class SSOEnabledEvent(analytics.Event):
    type = "sso.enabled"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("provider"),
    )


analytics.register(SSOEnabledEvent)
