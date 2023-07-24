import logging

from sentry.constants import ObjectStatus
from sentry.incidents.models import AlertRuleTriggerAction, Incident, IncidentStatus
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import RpcOrganizationIntegration
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.opsgenie")
from .client import OpsgenieClient


def build_incident_attachment(incident, new_status: IncidentStatus, metric_value=None):
    data = incident_attachment_info(incident, new_status, metric_value)
    alert_key = f"incident_{incident.organization_id}_{incident.identifier}"
    if new_status == IncidentStatus.CLOSED:
        payload = {"identifier": alert_key, "identifierType": "alias"}
    else:
        payload = {
            "message": incident.alert_rule.name,
            "alias": alert_key,
            "description": data["text"],
            "source": data["title_link"],
        }
    return payload


def get_team(org_integration: RpcOrganizationIntegration, team_id: str):
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
) -> None:
    integration, org_integration = integration_service.get_organization_context(
        organization_id=incident.organization_id, integration_id=action.integration_id
    )
    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        # Integration removed, but rule is still active.
        return

    team = get_team(org_integration=org_integration, team_id=action.target_identifier)
    if not team:
        # team removed, but the rule is still active
        return

    integration_key = team["integration_key"]
    client = OpsgenieClient(
        integration=integration,
        integration_key=integration_key,
        org_integration_id=incident.organization_id,
    )
    attachment = build_incident_attachment(incident, new_status, metric_value)
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
