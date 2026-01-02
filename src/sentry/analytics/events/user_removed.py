from sentry import analytics


@analytics.eventclass("user.removed")
class UserRemovedEvent(analytics.Event):
    user_id: int
    actor_id: int | None = None
    deletion_request_datetime: str | None = None
    deletion_datetime: str | None = None


analytics.register(UserRemovedEvent)
