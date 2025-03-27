from typing import Any

from sentry.notifications.notification_action.issue_alert_registry import (
    issue_alert_handler_registry,
)
from sentry.notifications.notification_action.issue_alert_registry.base import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import ActionFieldMapping


@issue_alert_handler_registry.register(Action.Type.WEBHOOK)
class WebhookIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_integration_id(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}
