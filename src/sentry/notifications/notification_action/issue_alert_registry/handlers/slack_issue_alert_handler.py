from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
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

    @classmethod
    def render_label(cls, organization_id: int, blob: dict[str, Any]) -> str:
        integration = integration_service.get_integration(
            integration_id=blob["workspace"],
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            return ""

        workspace = integration.name
        channel = blob["channel"]
        label = f"Send a notification to the {workspace} Slack workspace to #{channel}"
        has_tags = True if blob["tags"] != "" else False
        if has_tags:
            formatted_tags = "[{}]".format(
                ", ".join(tag.strip() for tag in blob["tags"].split(","))
            )
            label += f" and show tags {formatted_tags}"

        notes = blob["notes"]
        if notes != "":
            if has_tags:
                label += f' and notes "{notes}"'
            else:
                label += f' and show notes "{notes}"'

        if notes or has_tags:
            label += " in notification"

        return label
