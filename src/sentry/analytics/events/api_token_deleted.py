from sentry import analytics


@analytics.eventclass("api_token.deleted")
class ApiTokenDeleted(analytics.Event):
    user_id: int | None = None


analytics.register(ApiTokenDeleted)
