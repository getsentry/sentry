from sentry import analytics


@analytics.eventclass("integrations.serverless_setup")
class IntegrationServerlessSetup(analytics.Event):
    user_id: str
    organization_id: str
    integration: str
    success_count: str
    failure_count: str


analytics.register(IntegrationServerlessSetup)
