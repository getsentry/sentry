from sentry import analytics


@analytics.eventclass("webhook.repository_created")
class WebHookRepositoryCreatedEvent(analytics.Event):
    organization_id: str
    repository_id: str
    integration: str


analytics.register(WebHookRepositoryCreatedEvent)
