from sentry import analytics
from sentry.analytics import Event, eventclass


@eventclass("api_token.deleted")
class ApiTokenDeleted(Event):
    user_id: int


analytics.register(ApiTokenDeleted)
