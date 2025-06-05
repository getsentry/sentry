from sentry import analytics


@analytics.eventclass("sentry_app.created")
class SentryAppCreatedEvent(analytics.Event):
    user_id: str
    organization_id: str
    sentry_app: str
    created_alert_rule_ui_component: bool | None = None


analytics.register(SentryAppCreatedEvent)
