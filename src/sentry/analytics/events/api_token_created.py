from sentry import analytics


class ApiTokenCreated(analytics.Event):
    type = "api_token.created"

    attributes = (analytics.Attribute("user_id"),)


analytics.register(ApiTokenCreated)
