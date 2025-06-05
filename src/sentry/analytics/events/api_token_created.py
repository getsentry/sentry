from sentry import analytics


@analytics.eventclass("api_token.created")
class ApiTokenCreated(analytics.Event):
    user_id: str


analytics.register(ApiTokenCreated)
