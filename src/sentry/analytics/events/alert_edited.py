from typing import int
from sentry import analytics


@analytics.eventclass("alert.edited")
class AlertEditedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int
    organization_id: int
    rule_id: int
    rule_type: str
    is_api_token: bool


analytics.register(AlertEditedEvent)
