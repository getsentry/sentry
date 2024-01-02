from __future__ import annotations

import logging
from typing import Any, TypedDict

from django.db import router, transaction
from django.http import Http404

from sentry.incidents.models import AlertRuleTriggerAction, Incident, IncidentStatus
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import RpcOrganizationIntegration
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client.proxy import infer_org_integration
from sentry.shared_integrations.exceptions import ApiError

from .client import PagerDutyProxyClient

logger = logging.getLogger("sentry.integrations.pagerduty")


class PagerDutyServiceDict(TypedDict):
    integration_id: int
    integration_key: str
    service_name: str
    id: int


@control_silo_function
def add_service(
    organization_integration: OrganizationIntegration, integration_key: str, service_name: str
) -> PagerDutyServiceDict:
    with transaction.atomic(router.db_for_write(OrganizationIntegration)):
        OrganizationIntegration.objects.filter(id=organization_integration.id).select_for_update()

        with transaction.get_connection(
            router.db_for_write(OrganizationIntegration)
        ).cursor() as cursor:
            cursor.execute(
                "SELECT nextval(%s)", [f"{OrganizationIntegration._meta.db_table}_id_seq"]
            )
            next_id: int = cursor.fetchone()[0]

        service: PagerDutyServiceDict = {
            "id": next_id,
            "integration_key": integration_key,
            "service_name": service_name,
            "integration_id": organization_integration.integration_id,
        }

        existing = organization_integration.config.get("pagerduty_services", [])
        new_services: list[PagerDutyServiceDict] = existing + [service]
        organization_integration.config["pagerduty_services"] = new_services
        organization_integration.save()
    return service


def get_services(
    org_integration: OrganizationIntegration | RpcOrganizationIntegration | None,
) -> list[PagerDutyServiceDict]:
    if not org_integration:
        return []
    return org_integration.config.get("pagerduty_services", [])


def get_service(
    org_integration: OrganizationIntegration | RpcOrganizationIntegration | None,
    service_id: int | str,
) -> PagerDutyServiceDict | None:
    services = get_services(org_integration)
    if not services:
        return None
    service: PagerDutyServiceDict | None = None
    for candidate in services:
        if str(candidate["id"]) == str(service_id):
            service = candidate
            break
    return service


def build_incident_attachment(
    incident,
    integration_key,
    new_status: IncidentStatus,
    metric_value: float | None = None,
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
    metric_value: float,
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
        service = get_service(org_integration, action.target_identifier)

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
    # TODO(hybridcloud) This should use the integration.installation client workflow instead.
    client = PagerDutyProxyClient(
        org_integration_id=org_integration_id,
        integration_key=integration_key,
        keyid=str(service["id"]),
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
