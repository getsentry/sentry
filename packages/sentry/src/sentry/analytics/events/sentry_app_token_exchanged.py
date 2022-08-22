from sentry import analytics


class SentryAppTokenExchangedEvent(analytics.Event):
    type = "sentry_app.token_exchanged"

    attributes = (
        analytics.Attribute("sentry_app_installation_id"),
        analytics.Attribute("exchange_type"),
    )


analytics.register(SentryAppTokenExchangedEvent)
