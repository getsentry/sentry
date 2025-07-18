from sentry import analytics
from sentry.analytics import Event, eventclass


@eventclass("org_auth_token.deleted")
class OrgAuthTokenDeleted(Event):
    user_id: int | None = None
    organization_id: int


analytics.register(OrgAuthTokenDeleted)
