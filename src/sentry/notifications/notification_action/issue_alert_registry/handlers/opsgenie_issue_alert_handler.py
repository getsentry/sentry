from typing import Any

from sentry.integrations.opsgenie.utils import get_team
from sentry.integrations.services.integration import integration_service
from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import (
    OPSGENIE_DEFAULT_PRIORITY,
    ActionFieldMapping,
    OnCallDataBlob,
)


@issue_alert_handler_registry.register(Action.Type.OPSGENIE)
class OpsgenieIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        blob = OnCallDataBlob(**action.data)
        return {"priority": blob.priority}

    @classmethod
    def render_label(cls, organization_id: int, blob: dict[str, Any]) -> str:
        result = integration_service.organization_context(
            organization_id=organization_id,
            integration_id=blob["account"],
        )
        integration = result.integration
        org_integration = result.organization_integration

        if not integration:
            return ""

        account = integration.name
        team = get_team(blob["team"], org_integration)
        team_name = team["team"] if team else "[removed]"
        priority = blob.get("priority") or OPSGENIE_DEFAULT_PRIORITY

        return f"Send a notification to Opsgenie account {account} and team {team_name} with {priority} priority"
