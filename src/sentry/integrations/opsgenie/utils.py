from __future__ import annotations

import logging
from typing import Any, Optional

from sentry.constants import ObjectStatus
from sentry.incidents.models import AlertRuleTriggerAction, Incident, IncidentStatus
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import RpcOrganizationIntegration
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.opsgenie")
from .client import OpsgenieClient


def build_incident_attachment(
    incident: Incident,
    new_status: IncidentStatus,
    metric_value: int | None = None,
    notification_uuid: str | None = None,
) -> dict[str, Any]:
    data = incident_attachment_info(
        incident, new_status, metric_value, notification_uuid, referrer="metric_alert_opsgenie"
    )
    alert_key = f"incident_{incident.organization_id}_{incident.identifier}"
    if new_status == IncidentStatus.CLOSED:
        payload = {"identifier": alert_key}
        return payload

    priority = "P1"
    if new_status == IncidentStatus.WARNING:
        priority = "P2"
    payload = {
        "message": incident.alert_rule.name,
        "alias": alert_key,
        "description": data["text"],
        "source": "Sentry",
        "priority": priority,
        "details": {
            "URL": data["title_link"],  # type: ignore
        },
    }
    return payload


def get_team(team_id: Optional[str], org_integration: Optional[RpcOrganizationIntegration]):
    if not org_integration:
        return None
    teams = org_integration.config.get("team_table")
    if not teams:
        return None
    for team in teams:
        if team["id"] == team_id:
            return team
    return None


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: int,
    new_status: IncidentStatus,
    notification_uuid: str | None = None,
) -> None:
    integration, org_integration = integration_service.get_organization_context(
        organization_id=incident.organization_id, integration_id=action.integration_id
    )
    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        logger.info("Opsgenie integration removed, but the rule is still active.")
        return

    team = get_team(org_integration=org_integration, team_id=action.target_identifier)
    if not team:
        # team removed, but the rule is still active
        logger.info("Opsgenie team removed, but the rule is still active.")
        return

    integration_key = team["integration_key"]
    client = OpsgenieClient(
        integration=integration,
        integration_key=integration_key,
        org_integration_id=incident.organization_id,
    )
    attachment = build_incident_attachment(incident, new_status, metric_value, notification_uuid)
    try:
        client.send_notification(attachment)
    except ApiError as e:
        logger.info(
            "rule.fail.opsgenie_notification",
            extra={
                "error": str(e),
                "team_name": team["team"],
                "team_id": team["id"],
                "integration_id": action.integration_id,
            },
        )
        raise e
