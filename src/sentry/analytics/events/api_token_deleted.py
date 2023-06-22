from sentry import analytics


class ApiTokenDeleted(analytics.Event):
    type = "api_token.deleted"

    attributes = (analytics.Attribute("user_id"),)


analytics.register(ApiTokenDeleted)
