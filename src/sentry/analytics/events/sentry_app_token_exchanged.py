from typing import int
from sentry import analytics


@analytics.eventclass("sentry_app.token_exchanged")
class SentryAppTokenExchangedEvent(analytics.Event):
    sentry_app_installation_id: int
    exchange_type: str


analytics.register(SentryAppTokenExchangedEvent)
