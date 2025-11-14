from typing import int
from sentry import analytics


@analytics.eventclass("sso.enabled")
class SSOEnabledEvent(analytics.Event):
    user_id: int
    organization_id: int
    provider: str


analytics.register(SSOEnabledEvent)
