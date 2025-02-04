from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization

from .constants import SUPPORTED_INTEGRATIONS


class InstallationNotFoundError(Exception):
    pass


class InstallationCannotGetTreesError(Exception):
    pass


def get_installation(organization: Organization) -> IntegrationInstallation:
    integrations = integration_service.get_integrations(
        organization_id=organization.id,
        providers=SUPPORTED_INTEGRATIONS,
        status=ObjectStatus.ACTIVE,
    )
    if len(integrations) == 0:
        raise InstallationNotFoundError

    # XXX: We only operate on the first integration for an organization.
    integration = integrations[0]
    installation = integration.get_installation(organization_id=organization.id)

    if not installation:
        raise InstallationNotFoundError

    if not hasattr(installation, "get_trees_for_org"):
        raise InstallationCannotGetTreesError

    return installation
