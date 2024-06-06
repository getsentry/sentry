from sentry import features
from sentry.models.integrations.integration import OrganizationIntegration
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.silo.base import SiloMode

# TEMPORARY FUNCTIONS FOR FEATURES


def fetch_org_id_from_integration_id(integration_id: int) -> int | None:
    if SiloMode.get_current_mode() == SiloMode.REGION:
        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration_id, status=0
        )
        org_integration = org_integrations[0] if org_integrations else None
    else:  # control or monolith (local)
        org_integration = OrganizationIntegration.objects.filter(
            integration_id=integration_id
        ).first()

    if not org_integration:
        return None

    return org_integration.organization_id


def has_slack_sdk_flag(organization: Organization) -> bool:
    return features.has("organizations:slack-sdk-issue-alert-action", organization)
