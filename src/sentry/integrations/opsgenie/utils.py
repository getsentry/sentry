from __future__ import annotations

import logging
from typing import Any, cast

from sentry.constants import ObjectStatus
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
)
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.opsgenie")

OPSGENIE_CUSTOM_PRIORITIES = {"P1", "P2", "P3", "P4", "P5"}


def build_incident_attachment(
    alert_context: AlertContext,
    metric_issue_context: MetricIssueContext,
    organization: Organization,
    notification_uuid: str | None = None,
) -> dict[str, Any]:
    data = incident_attachment_info(
        metric_issue_context=metric_issue_context,
        alert_context=alert_context,
        organization=organization,
        notification_uuid=notification_uuid,
        referrer="metric_alert_opsgenie",
    )

    alert_key = f"incident_{organization.id}_{metric_issue_context.open_period_identifier}"
    if metric_issue_context.new_status == IncidentStatus.CLOSED:
        payload = {"identifier": alert_key}
        return payload

    priority = "P1"
    if metric_issue_context.new_status == IncidentStatus.WARNING:
        priority = "P2"
    payload = {
        "message": alert_context.name,
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
    data: dict[str, Any], notification_context: NotificationContext, new_status: IncidentStatus
) -> dict[str, Any]:
    sentry_app_config = notification_context.sentry_app_config
    # use custom severity (overrides default in build_incident_attachment)
    if new_status == IncidentStatus.CLOSED or sentry_app_config is None:
        return data

    if isinstance(sentry_app_config, list):
        raise ValueError("Sentry app config must be a single dict")

    priority = sentry_app_config.get("priority", OPSGENIE_DEFAULT_PRIORITY)
    data["priority"] = priority
    return data


def get_team(
    team_id: int | str | None, org_integration: RpcOrganizationIntegration | None
) -> dict[str, str] | None:
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
    notification_context: NotificationContext,
    alert_context: AlertContext,
    metric_issue_context: MetricIssueContext,
    organization: Organization,
    notification_uuid: str | None = None,
) -> bool:
    from sentry.integrations.opsgenie.integration import OpsgenieIntegration

    result = integration_service.organization_context(
        organization_id=organization.id, integration_id=notification_context.integration_id
    )
    integration = result.integration
    org_integration = result.organization_integration
    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        logger.info("Opsgenie integration removed, but the rule is still active.")
        return False

    team = get_team(org_integration=org_integration, team_id=notification_context.target_identifier)
    if not team:
        # team removed, but the rule is still active
        logger.info("Opsgenie team removed, but the rule is still active.")
        return False

    install = cast(
        "OpsgenieIntegration",
        integration.get_installation(organization_id=org_integration.organization_id),
    )
    client = install.get_keyring_client(keyid=team["id"])
    attachment = build_incident_attachment(
        alert_context=alert_context,
        metric_issue_context=metric_issue_context,
        organization=organization,
        notification_uuid=notification_uuid,
    )
    attachment = attach_custom_priority(
        attachment, notification_context, metric_issue_context.new_status
    )

    try:
        resp = client.send_metric_alert_notification(attachment)
        logger.info(
            "rule.success.opsgenie_incident_alert",
            extra={
                "status_code": resp.status_code,
                "organization_id": organization.id,
                "data": attachment,
                "status": metric_issue_context.new_status.value,
                "team_name": team["team"],
                "team_id": team["id"],
                "integration_id": notification_context.integration_id,
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
                "integration_id": notification_context.integration_id,
            },
        )
        raise
