from typing import int, Any

from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import ActionFieldMapping, DiscordDataBlob


@issue_alert_handler_registry.register(Action.Type.DISCORD)
class DiscordIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        blob = DiscordDataBlob(**action.data)
        return {"tags": blob.tags}

    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}
