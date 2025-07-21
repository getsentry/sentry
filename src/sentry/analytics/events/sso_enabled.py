from sentry import analytics


@analytics.eventclass("sso.enabled")
class SSOEnabledEvent(analytics.Event):
    user_id: str
    organization_id: str
    provider: str


analytics.register(SSOEnabledEvent)
