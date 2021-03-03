from sentry import analytics


class UserCreatedEvent(analytics.Event):
    type = "user.created"

    attributes = (
        analytics.Attribute("id"),
        analytics.Attribute("username"),
        analytics.Attribute("email"),
    )


analytics.register(UserCreatedEvent)
