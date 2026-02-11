from sentry import analytics


@analytics.eventclass("integrations.serverless_setup")
class IntegrationServerlessSetup(analytics.Event):
    user_id: int | None
    organization_id: int
    integration: str
    success_count: int
    failure_count: int


analytics.register(IntegrationServerlessSetup)
