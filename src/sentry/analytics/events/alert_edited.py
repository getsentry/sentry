from sentry import analytics


@analytics.eventclass("alert.edited")
class AlertEditedEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    organization_id: str
    rule_id: str
    rule_type: str
    is_api_token: str


analytics.register(AlertEditedEvent)
