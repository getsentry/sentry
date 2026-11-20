from typing import Final

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.organization import Organization
from sentry.seer.seer_setup import get_supported_scm_providers

# Set on an empty repository list when the organization has no source control Seer can open, so a
# Seer chat asks the user to connect it instead of reporting that there are no repositories.
SCM_CONNECT_HEADER = "X-Sentry-Scm-Connect"
NO_SCM_INTEGRATION: Final = "no_scm_integration"


def get_seer_scm_integrations(organization_id: int, providers: list[str]) -> list[RpcIntegration]:
    """The organization's active source control integrations from these providers."""
    return integration_service.get_integrations(
        organization_id=organization_id,
        providers=providers,
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
    )


def has_seer_scm_integration(organization: Organization) -> bool:
    """Whether the organization has source control connected that Seer can open repositories from."""
    return bool(
        get_seer_scm_integrations(organization.id, get_supported_scm_providers(organization))
    )


def mark_no_scm_integration[R: Response](
    request: Request, response: R, organization: Organization
) -> R:
    """Say in `SCM_CONNECT_HEADER` when an empty repository list is empty because the organization
    has no source control connected.

    Only the first page is checked: a later empty page only means the list ended. The check is a
    call to the control silo, so a list with repositories skips it.
    """
    if response.status_code != 200 or response.data or request.GET.get("cursor"):
        return response
    if not has_seer_scm_integration(organization):
        response[SCM_CONNECT_HEADER] = NO_SCM_INTEGRATION
    return response
