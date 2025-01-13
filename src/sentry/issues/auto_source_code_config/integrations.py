from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.integration import RpcOrganizationIntegration, integration_service
from sentry.models.organization import Organization

SUPPORTED_PROVIDERS = ["github"]


def get_organization_installation(
    organization: Organization,
) -> tuple[IntegrationInstallation | None, RpcOrganizationIntegration | None]:
    integrations = integration_service.get_integrations(
        organization_id=organization.id,
        providers=SUPPORTED_PROVIDERS,
        status=ObjectStatus.ACTIVE,
    )
    if len(integrations) == 0:
        return None, None

    # XXX: We only operate on the first github integration for an organization.
    integration = integrations[0]
    organization_integration = integration_service.get_organization_integration(
        integration_id=integration.id, organization_id=organization.id
    )
    if not organization_integration:
        return None, None

    installation = integration.get_installation(organization_id=organization.id)

    return installation, organization_integration
