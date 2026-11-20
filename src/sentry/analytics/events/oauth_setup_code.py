from sentry import analytics


@analytics.eventclass("oauth.setup_code_issued")
class OAuthSetupCodeIssuedEvent(analytics.Event):
    user_id: int
    organization_id: int | None
    application_id: int
    setup_code_id: int
    flow: str


@analytics.eventclass("oauth.setup_code_redeemed")
class OAuthSetupCodeRedeemedEvent(analytics.Event):
    user_id: int
    organization_id: int | None
    application_id: int
    setup_code_id: int
    outcome: str


analytics.register(OAuthSetupCodeIssuedEvent)
analytics.register(OAuthSetupCodeRedeemedEvent)
