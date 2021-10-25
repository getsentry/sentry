from sentry import analytics


class AlertRuleUiComponentWebhookSentEvent(analytics.Event):
    type = "alert_rule_ui_component_webhook.sent"

    attributes = (
        # organization_id refers to the organization that installed the sentryapp
        analytics.Attribute("organization_id", type=str, required=True),
        analytics.Attribute("sentry_app_id", type=str, required=True),
        analytics.Attribute("event", type=str, required=True),
    )


analytics.register(AlertRuleUiComponentWebhookSentEvent)
