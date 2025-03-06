from __future__ import annotations

import logging
from typing import Any, cast

from sentry.constants import ObjectStatus
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.metric_alerts import (
    AlertContext,
    get_metric_count_from_incident,
    incident_attachment_info,
)
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.opsgenie")

OPSGENIE_CUSTOM_PRIORITIES = {"P1", "P2", "P3", "P4", "P5"}


def build_incident_attachment(
    incident: Incident,
    new_status: IncidentStatus,
    metric_value: float | None = None,
    notification_uuid: str | None = None,
) -> dict[str, Any]:
    if metric_value is None:
        metric_value = get_metric_count_from_incident(incident)

    data = incident_attachment_info(
        AlertContext.from_alert_rule_incident(incident.alert_rule),
        open_period_identifier=incident.identifier,
        organization=incident.organization,
        snuba_query=incident.alert_rule.snuba_query,
        new_status=new_status,
        metric_value=metric_value,
        notification_uuid=notification_uuid,
        referrer="metric_alert_opsgenie",
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
            "URL": data["title_link"],  # type: ignore[dict-item]
        },
    }
    return payload


def attach_custom_priority(
    data: dict[str, Any], action: AlertRuleTriggerAction, new_status: IncidentStatus
) -> dict[str, Any]:
    app_config = action.get_single_sentry_app_config()
    if new_status == IncidentStatus.CLOSED or app_config is None:
        return data

    priority = app_config.get("priority", OPSGENIE_DEFAULT_PRIORITY)
    data["priority"] = priority
    return data


def get_team(team_id: int | str | None, org_integration: RpcOrganizationIntegration | None):
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
    metric_value: float,
    new_status: IncidentStatus,
    notification_uuid: str | None = None,
) -> bool:
    from sentry.integrations.opsgenie.integration import OpsgenieIntegration

    result = integration_service.organization_context(
        organization_id=incident.organization_id, integration_id=action.integration_id
    )
    integration = result.integration
    org_integration = result.organization_integration
    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        logger.info("Opsgenie integration removed, but the rule is still active.")
        return False

    team = get_team(org_integration=org_integration, team_id=action.target_identifier)
    if not team:
        # team removed, but the rule is still active
        logger.info("Opsgenie team removed, but the rule is still active.")
        return False

    install = cast(
        "OpsgenieIntegration",
        integration.get_installation(organization_id=org_integration.organization_id),
    )
    client = install.get_keyring_client(keyid=team["id"])
    attachment = build_incident_attachment(incident, new_status, metric_value, notification_uuid)
    attachment = attach_custom_priority(attachment, action, new_status)

    try:
        resp = client.send_notification(attachment)
        logger.info(
            "rule.success.opsgenie_incident_alert",
            extra={
                "status_code": resp.status_code,
                "organization_id": incident.organization_id,
                "data": attachment,
                "status": new_status.value,
                "team_name": team["team"],
                "team_id": team["id"],
                "integration_id": action.integration_id,
            },
        )
        return True
    except ApiError as e:
        logger.info(
            "rule.fail.opsgenie_notification",
            extra={
                "error": str(e),
                "data": attachment,
                "team_name": team["team"],
                "team_id": team["id"],
                "integration_id": action.integration_id,
            },
        )
        raise
