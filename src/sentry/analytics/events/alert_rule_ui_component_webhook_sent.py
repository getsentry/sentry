from sentry import analytics


class AlertRuleUiComponentWebhookSentEvent(analytics.Event):
    type = "alert_rule_ui_component_webhook.sent"

    attributes = (
        # organization_id refers to the organization that installed the sentryapp
        analytics.Attribute("organization_id"),
        analytics.Attribute("sentry_app_id"),
        analytics.Attribute("event"),
    )


analytics.register(AlertRuleUiComponentWebhookSentEvent)
