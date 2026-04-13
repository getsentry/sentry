from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action


@issue_alert_handler_registry.register(Action.Type.MSTEAMS)
class MSTeamsIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def render_label(cls, organization_id: int, blob: dict[str, Any]) -> str:
        integration = integration_service.get_integration(
            integration_id=blob["team"],
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            return ""

        team = integration.name
        channel = blob["channel"]
        return f"Send a notification to the {team} Team to {channel}"
