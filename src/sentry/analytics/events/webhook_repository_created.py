from sentry import analytics


class WebHookRepositoryCreatedEvent(analytics.Event):
    type = "webhook.repository_created"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("repository_id"),
        analytics.Attribute("integration"),
    )


analytics.register(WebHookRepositoryCreatedEvent)
