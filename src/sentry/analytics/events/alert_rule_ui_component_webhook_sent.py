from sentry import analytics


@analytics.eventclass("alert_rule_ui_component_webhook.sent")
class AlertRuleUiComponentWebhookSentEvent(analytics.Event):
    # organization_id refers to the organization that installed the sentryapp
    organization_id: int
    sentry_app_id: int
    event: str


analytics.register(AlertRuleUiComponentWebhookSentEvent)
