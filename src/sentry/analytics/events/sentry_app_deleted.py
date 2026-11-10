from sentry import analytics


@analytics.eventclass("sentry_app.deleted")
class SentryAppDeletedEvent(analytics.Event):
    user_id: int | None
    organization_id: int
    sentry_app: str


analytics.register(SentryAppDeletedEvent)
