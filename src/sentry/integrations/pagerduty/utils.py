from __future__ import annotations

import logging
from typing import Any

from django.http import Http404

from sentry.incidents.models import AlertRuleTriggerAction, Incident, IncidentStatus
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models.integrations.organization_integration import (
    OrganizationIntegration,
    PagerDutyServiceDict,
)
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.client.proxy import infer_org_integration
from sentry.shared_integrations.exceptions import ApiError

from .client import PagerDutyProxyClient

logger = logging.getLogger("sentry.integrations.pagerduty")


def build_incident_attachment(
    incident,
    integration_key,
    new_status: IncidentStatus,
    metric_value: int | None = None,
    notfiication_uuid: str | None = None,
) -> dict[str, Any]:
    data = incident_attachment_info(
        incident, new_status, metric_value, notfiication_uuid, referrer="metric_alert_pagerduty"
    )
    severity = "info"
    if new_status == IncidentStatus.CRITICAL:
        severity = "critical"
    elif new_status == IncidentStatus.WARNING:
        severity = "warning"
    elif new_status == IncidentStatus.CLOSED:
        severity = "info"

    event_action = "resolve"
    if new_status in [IncidentStatus.WARNING, IncidentStatus.CRITICAL]:
        event_action = "trigger"

    return {
        "routing_key": integration_key,
        "event_action": event_action,
        "dedup_key": f"incident_{incident.organization_id}_{incident.identifier}",
        "payload": {
            "summary": incident.alert_rule.name,
            "severity": severity,
            "source": str(incident.identifier),
            "custom_details": {"details": data["text"]},
        },
        "links": [{"href": data["title_link"], "text": data["title"]}],
    }


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: int,
    new_status: IncidentStatus,
    notification_uuid: str | None = None,
) -> bool:
    integration_id = action.integration_id
    organization_id = incident.organization_id

    service: PagerDutyServiceDict | None = None
    org_integration = integration_service.get_organization_integration(
        integration_id=integration_id,
        organization_id=organization_id,
    )
    if org_integration is None:
        org_integration_id = infer_org_integration(integration_id=integration_id, ctx_logger=logger)
        org_integrations = integration_service.get_organization_integrations(
            org_integration_ids=[org_integration_id]
        )
        if org_integrations:
            org_integration = org_integrations[0]
    else:
        org_integration_id = org_integration.id

    if org_integration and action.target_identifier:
        service = OrganizationIntegration.find_service(
            org_integration.config, action.target_identifier
        )

    if service is None:
        # service has been removed after rule creation
        logger.info(
            "fetch.fail.pagerduty_metric_alert",
            extra={
                "integration_id": integration_id,
                "organization_id": incident.organization_id,
                "target_identifier": action.target_identifier,
            },
        )
        raise Http404

    integration_key = service["integration_key"]
    client = PagerDutyProxyClient(
        org_integration_id=org_integration_id, integration_key=integration_key
    )
    attachment = build_incident_attachment(
        incident, integration_key, new_status, metric_value, notification_uuid
    )
    try:
        client.send_trigger(attachment)
        return True
    except ApiError as e:
        logger.info(
            "rule.fail.pagerduty_metric_alert",
            extra={
                "error": str(e),
                "service_name": service["service_name"],
                "service_id": service["id"],
                "integration_id": integration_id,
            },
        )
        raise e
