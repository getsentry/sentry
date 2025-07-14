from sentry import analytics


@analytics.eventclass("alert.created")
class AlertCreatedEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    organization_id: str
    rule_id: int
    rule_type: str
    is_api_token: bool
    # `alert_rule_ui_component` can be `alert-rule-action`
    alert_rule_ui_component: str | None = None
    duplicate_rule: str | None = None
    wizard_v3: str | None = None
    query_type: str | None = None


analytics.register(AlertCreatedEvent)
