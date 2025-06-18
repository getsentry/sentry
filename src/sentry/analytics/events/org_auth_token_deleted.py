from sentry import analytics


@analytics.eventclass("org_auth_token.deleted")
class OrgAuthTokenDeleted(analytics.Event):
    user_id: str
    organization_id: str


analytics.register(OrgAuthTokenDeleted)
