from sentry.models import Integration, OrganizationIntegration
from sentry.services.hybrid_cloud.integration import RpcIntegration, RpcOrganizationIntegration


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
    return RpcOrganizationIntegration(
        id=oi.id,
        default_auth_id=oi.default_auth_id,
        organization_id=oi.organization_id,
        integration_id=oi.integration_id,
        config=oi.config,
        status=oi.status,
        grace_period_end=oi.grace_period_end,
    )
