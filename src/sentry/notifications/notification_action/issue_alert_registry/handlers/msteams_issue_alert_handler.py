from sentry.notifications.notification_action.issue_alert_registry import (
    issue_alert_handler_registry,
)
from sentry.notifications.notification_action.issue_alert_registry.base import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action


@issue_alert_handler_registry.register(Action.Type.MSTEAMS)
class MSTeamsIssueAlertHandler(BaseIssueAlertHandler):
    pass
