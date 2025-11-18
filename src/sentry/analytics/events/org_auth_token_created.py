from sentry import analytics


@analytics.eventclass("org_auth_token.created")
class OrgAuthTokenCreated(analytics.Event):
    user_id: int | None = None
    organization_id: int


analytics.register(OrgAuthTokenCreated)
