from sentry import analytics


@analytics.eventclass("sentry_app.deleted")
class SentryAppDeletedEvent(analytics.Event):
    user_id: str
    organization_id: str
    sentry_app: str


analytics.register(SentryAppDeletedEvent)
