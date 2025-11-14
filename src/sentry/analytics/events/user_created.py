from typing import int
from sentry import analytics


@analytics.eventclass("user.created")
class UserCreatedEvent(analytics.Event):
    id: int
    username: str
    email: str


analytics.register(UserCreatedEvent)
