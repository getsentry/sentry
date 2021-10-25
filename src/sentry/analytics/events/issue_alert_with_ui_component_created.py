from sentry import analytics


class IssueAlertWithUiComponentCreatedEvent(analytics.Event):
    type = "issue_alert_with_ui_component.created"

    attributes = (
        analytics.Attribute("user_id", type=str, required=True),
        analytics.Attribute("rule_id", type=str, required=True),
        analytics.Attribute("organization_id", type=str, required=True),
    )


analytics.register(IssueAlertWithUiComponentCreatedEvent)
