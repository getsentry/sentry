from sentry import analytics


@analytics.eventclass("user.created")
class UserCreatedEvent(analytics.Event):
    id: str
    username: str
    email: str


analytics.register(UserCreatedEvent)
