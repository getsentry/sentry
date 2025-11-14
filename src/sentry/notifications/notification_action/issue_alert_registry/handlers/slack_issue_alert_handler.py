from typing import int, Any

from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import ActionFieldMapping, SlackDataBlob


@issue_alert_handler_registry.register(Action.Type.SLACK)
class SlackIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        blob = SlackDataBlob(**action.data)
        return {
            "tags": blob.tags,
            "notes": blob.notes,
        }
