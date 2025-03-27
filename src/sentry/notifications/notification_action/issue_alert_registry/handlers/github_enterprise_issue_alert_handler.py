from sentry.notifications.notification_action.issue_alert_registry import (
    issue_alert_handler_registry,
)
from sentry.notifications.notification_action.issue_alert_registry.base import (
    TicketingIssueAlertHandler,
)
from sentry.workflow_engine.models import Action


@issue_alert_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
class GithubEnterpriseIssueAlertHandler(TicketingIssueAlertHandler):
    pass
