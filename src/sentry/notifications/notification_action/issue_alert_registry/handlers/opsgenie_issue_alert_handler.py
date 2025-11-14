from typing import int, Any

from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import ActionFieldMapping, OnCallDataBlob


@issue_alert_handler_registry.register(Action.Type.OPSGENIE)
class OpsgenieIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        blob = OnCallDataBlob(**action.data)
        return {"priority": blob.priority}
