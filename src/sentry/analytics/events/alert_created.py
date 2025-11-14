from typing import int
from sentry import analytics


@analytics.eventclass("alert.created")
class AlertCreatedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int | str | None = None
    organization_id: int
    project_id: int
    rule_id: int
    rule_type: str
    referrer: str | None = None
    session_id: str | None = None
    is_api_token: bool
    # `alert_rule_ui_component` can be `alert-rule-action`
    alert_rule_ui_component: str | None = None
    duplicate_rule: str | None = None
    wizard_v3: str | None = None
    query_type: str | None = None


analytics.register(AlertCreatedEvent)
