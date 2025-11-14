from typing import int
from sentry import analytics


@analytics.eventclass("sentry_app.updated")
class SentryAppUpdatedEvent(analytics.Event):
    user_id: int
    organization_id: int
    sentry_app: str
    created_alert_rule_ui_component: bool | None = None


analytics.register(SentryAppUpdatedEvent)
