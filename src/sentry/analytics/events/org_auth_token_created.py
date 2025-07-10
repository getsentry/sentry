from sentry import analytics
from sentry.analytics import Event, eventclass


@eventclass("org_auth_token.created")
class OrgAuthTokenCreated(Event):
    user_id: int
    organization_id: int


analytics.register(OrgAuthTokenCreated)
