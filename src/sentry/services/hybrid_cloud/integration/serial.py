from typing import Any, Dict

from sentry.models import Integration, OrganizationIntegration, PagerDutyService
from sentry.models.integrations.integration_external_project import IntegrationExternalProject
from sentry.services.hybrid_cloud.integration import RpcIntegration, RpcOrganizationIntegration
from sentry.services.hybrid_cloud.integration.model import RpcIntegrationExternalProject
from sentry.types.integrations import ExternalProviders


def serialize_integration(integration: Integration) -> RpcIntegration:
    return RpcIntegration(
        id=integration.id,
        provider=integration.provider,
        external_id=integration.external_id,
        name=integration.name,
        metadata=integration.metadata,
        status=integration.status,
    )


def serialize_organization_integration(oi: OrganizationIntegration) -> RpcOrganizationIntegration:
    config: Dict[str, Any] = dict(**oi.config)
    if oi.integration.provider == ExternalProviders.PAGERDUTY.name:
        config["pagerduty_services"] = [
            pds.as_dict()
            for pds in PagerDutyService.objects.filter(organization_integration_id=oi.id)
        ]

    return RpcOrganizationIntegration(
        id=oi.id,
        default_auth_id=oi.default_auth_id,
        organization_id=oi.organization_id,
        integration_id=oi.integration_id,
        config=config,
        status=oi.status,
        grace_period_end=oi.grace_period_end,
    )


def serialize_integration_external_project(
    iep: IntegrationExternalProject,
) -> RpcIntegrationExternalProject:
    return RpcIntegrationExternalProject(
        id=iep.id,
        organization_integration_id=iep.organization_integration_id,
        name=iep.name,
        external_id=iep.external_id,
        resolved_status=iep.resolved_status,
        unresolved_status=iep.unresolved_status,
    )
