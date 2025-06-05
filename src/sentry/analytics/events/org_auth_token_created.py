from sentry import analytics


@analytics.eventclass("org_auth_token.created")
class OrgAuthTokenCreated(analytics.Event):
    user_id: str
    organization_id: str


analytics.register(OrgAuthTokenCreated)
