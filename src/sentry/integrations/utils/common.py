import logging

from sentry.models.organization import OrganizationStatus
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.types.integrations import ExternalProviderEnum

_default_logger = logging.getLogger(__name__)


def get_active_integration_for_organization(
    organization_id: int, provider: ExternalProviderEnum
) -> RpcIntegration | None:
    try:
        return integration_service.get_integration(
            organization_id=organization_id,
            status=OrganizationStatus.ACTIVE,
            provider=provider.value,
        )
    except Exception as err:
        _default_logger.info(
            "error getting active integration for organization from service",
            exc_info=err,
            extra={
                "organization_id": organization_id,
                "provider": provider.value,
            },
        )
        return None
