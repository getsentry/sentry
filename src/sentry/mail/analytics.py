from sentry import analytics


# TODO: should have same base class as SlackIntegrationNotificationSent
class EmailNotificationSent(analytics.Event):
    type = "integrations.email.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id", required=False),
        analytics.Attribute("category"),
        analytics.Attribute("actor_id", required=False),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("group_id", required=False),
        analytics.Attribute("id"),
        analytics.Attribute("actor_type"),
        # Remove after IssueAlertFallbackExperiment
        analytics.Attribute("fallback_experiment", required=False),
    )


analytics.register(EmailNotificationSent)
