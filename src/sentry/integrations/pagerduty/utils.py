from __future__ import annotations

import logging
from typing import Any, TypedDict

from django.db import router, transaction
from django.http import Http404

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.metric_alerts import (
    AlertContext,
    get_metric_count_from_incident,
    incident_attachment_info,
)
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pagerduty.client import PAGERDUTY_DEFAULT_SEVERITY
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.models.organization import Organization
from sentry.shared_integrations.client.proxy import infer_org_integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import control_silo_function
from sentry.snuba.models import SnubaQuery
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.pagerduty")

PAGERDUTY_CUSTOM_PRIORITIES = {
    "critical",
    "warning",
    "error",
    "info",
}  # known as severities in pagerduty


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
    alert_context: AlertContext,
    open_period_identifier: int,
    organization: Organization,
    snuba_query: SnubaQuery,
    integration_key,
    new_status: IncidentStatus,
    metric_value: float | None = None,
    notification_uuid: str | None = None,
) -> dict[str, Any]:

    data = incident_attachment_info(
        alert_context=alert_context,
        open_period_identifier=open_period_identifier,
        organization=organization,
        snuba_query=snuba_query,
        metric_value=metric_value,
        new_status=new_status,
        notification_uuid=notification_uuid,
        referrer="metric_alert_pagerduty",
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
        "dedup_key": f"incident_{organization.id}_{open_period_identifier}",
        "payload": {
            "summary": alert_context.name,
            "severity": severity,
            "source": str(open_period_identifier),
            "custom_details": {"details": data["text"]},
        },
        "links": [{"href": data["title_link"], "text": data["title"]}],
    }


def attach_custom_severity(
    data: dict[str, Any], action: AlertRuleTriggerAction, new_status: IncidentStatus
) -> dict[str, Any]:
    # use custom severity (overrides default in build_incident_attachment)
    app_config = action.get_single_sentry_app_config()
    if new_status == IncidentStatus.CLOSED or app_config is None:
        return data

    severity = app_config.get("priority", None)
    if severity is not None and severity != PAGERDUTY_DEFAULT_SEVERITY:
        data["payload"]["severity"] = severity

    return data


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    new_status: IncidentStatus,
    metric_value: float | None = None,
    notification_uuid: str | None = None,
) -> bool:
    from sentry.integrations.pagerduty.integration import PagerDutyIntegration

    integration_id = action.integration_id
    organization_id = incident.organization_id

    result = integration_service.organization_context(
        organization_id=organization_id,
        integration_id=integration_id,
    )
    integration = result.integration
    org_integration = result.organization_integration
    if integration is None:
        logger.info(
            "pagerduty.integration.missing",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
            },
        )
        raise Http404

    org_integration_id: int | None = None
    if org_integration:
        org_integration_id = org_integration.id
    else:
        org_integrations = None
        if integration_id is not None:
            org_integration_id = infer_org_integration(
                integration_id=integration_id, ctx_logger=logger
            )
        if org_integration_id:
            org_integrations = integration_service.get_organization_integrations(
                org_integration_ids=[org_integration_id]
            )
        if org_integrations:
            org_integration = org_integrations[0]

    install = integration.get_installation(organization_id=organization_id)
    assert isinstance(install, PagerDutyIntegration)
    try:
        client = install.get_keyring_client(str(action.target_identifier))
    except ValueError:
        # service has been removed after rule creation
        logger.info(
            "fetch.fail.pagerduty_metric_alert",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "target_identifier": action.target_identifier,
            },
        )
        metrics.incr(
            "pagerduty.metric_alert_rule.integration_removed_after_rule_creation", sample_rate=1.0
        )
        return False

    if metric_value is None:
        metric_value = get_metric_count_from_incident(incident)

    attachment = build_incident_attachment(
        alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
        open_period_identifier=incident.identifier,
        organization=incident.organization,
        snuba_query=incident.alert_rule.snuba_query,
        integration_key=client.integration_key,
        new_status=new_status,
        metric_value=metric_value,
        notification_uuid=notification_uuid,
    )
    attachment = attach_custom_severity(attachment, action, new_status)

    try:
        client.send_trigger(attachment)
        return True
    except ApiError as e:
        logger.info(
            "rule.fail.pagerduty_metric_alert",
            extra={
                "error": str(e),
                "service_id": action.target_identifier,
                "integration_id": integration_id,
            },
        )
        raise
