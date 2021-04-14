from sentry import analytics


class IntegrationServerlessSetup(analytics.Event):
    type = "integrations.serverless_setup"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("integration"),
        analytics.Attribute("success_count"),
        analytics.Attribute("failure_count"),
    )


analytics.register(IntegrationServerlessSetup)
