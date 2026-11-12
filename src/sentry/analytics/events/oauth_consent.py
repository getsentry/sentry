from sentry import analytics


@analytics.eventclass("oauth.consent")
class OAuthConsentEvent(analytics.Event):
    user_id: int
    application_id: int
    response_type: str
    outcome: str


analytics.register(OAuthConsentEvent)
