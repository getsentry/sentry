from typing import int
from sentry import analytics


@analytics.eventclass("webhook.repository_created")
class WebHookRepositoryCreatedEvent(analytics.Event):
    organization_id: int
    repository_id: int
    integration: str


analytics.register(WebHookRepositoryCreatedEvent)
