from sentry import analytics


@analytics.eventclass("internal_integration.created")
class InternalIntegrationCreatedEvent(analytics.Event):
    user_id: str
    organization_id: str
    sentry_app: str


analytics.register(InternalIntegrationCreatedEvent)
