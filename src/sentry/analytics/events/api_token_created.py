from sentry import analytics
from sentry.analytics import Event, eventclass


@eventclass("api_token.created")
class ApiTokenCreated(Event):
    user_id: int | None = None


analytics.register(ApiTokenCreated)
