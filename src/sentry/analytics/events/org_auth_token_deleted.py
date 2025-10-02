from sentry import analytics


@analytics.eventclass("org_auth_token.deleted")
class OrgAuthTokenDeleted(analytics.Event):
    user_id: int | None = None
    organization_id: int


analytics.register(OrgAuthTokenDeleted)
