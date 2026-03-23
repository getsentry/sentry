from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
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

    @classmethod
    def render_label(cls, organization_id: int, blob: dict[str, Any]) -> str:
        integration = integration_service.get_integration(
            integration_id=blob["server"],
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            return ""

        server = integration.name
        channel_id = blob["channel_id"]
        tags = [s.strip() for s in blob["tags"].split(",")]
        formatted_tags = "[{}]".format(", ".join(tags))
        return f"Send a notification to the {server} Discord server in the channel with ID or URL: {channel_id} and show tags {formatted_tags} in the notification."
