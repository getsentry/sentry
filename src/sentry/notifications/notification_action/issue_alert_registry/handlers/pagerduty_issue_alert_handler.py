from typing import Any

from sentry.integrations.pagerduty.utils import get_service
from sentry.integrations.services.integration import integration_service
from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import (
    PAGERDUTY_DEFAULT_SEVERITY,
    ActionFieldMapping,
    OnCallDataBlob,
)


@issue_alert_handler_registry.register(Action.Type.PAGERDUTY)
class PagerDutyIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        blob = OnCallDataBlob(**action.data)
        return {"severity": blob.priority}

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
        service = get_service(org_integration, blob["service"])
        service_name = service["service_name"] if service else "[removed]"
        severity = blob.get("severity") or PAGERDUTY_DEFAULT_SEVERITY

        return f"Send a notification to PagerDuty account {account} and service {service_name} with {severity} severity"
