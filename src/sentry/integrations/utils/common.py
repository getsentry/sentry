import logging

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.types import ExternalProviderEnum

_default_logger = logging.getLogger(__name__)


def get_active_integration_for_organization(
    organization_id: int, provider: ExternalProviderEnum
) -> RpcIntegration | None:
    try:
        return integration_service.get_integration(
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
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


def get_integration_id_integration_mapping_for_organization(
    organization_id: int,
    provider: ExternalProviderEnum,
) -> dict[int, RpcIntegration]:
    """
    Returns a mapping of integration id to integration for the given organization.
    """
    try:
        integrations = integration_service.get_integrations(
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
            providers=[provider.value],
        )
        return {integration.id: integration for integration in integrations}
    except Exception as err:
        _default_logger.info(
            "error getting active integrations for organization from service",
            exc_info=err,
            extra={"organization_id": organization_id},
        )
        return {}
