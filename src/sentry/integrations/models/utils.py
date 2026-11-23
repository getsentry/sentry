from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.integrations.base import (
        IntegrationFeatures,
        IntegrationInstallation,
        IntegrationProvider,
    )
    from sentry.integrations.models.integration import Integration
    from sentry.integrations.services.integration.model import RpcIntegration


def get_provider(instance: Integration | RpcIntegration) -> IntegrationProvider:
    from sentry.integrations.manager import default_manager as integrations

    return integrations.get(instance.provider)


def get_installation(
    instance: Integration | RpcIntegration, organization_id: int, **kwargs: Any
) -> IntegrationInstallation:
    installation = instance.get_provider().get_installation(
        model=instance,
        organization_id=organization_id,
        **kwargs,
    )
    return installation


def has_feature(instance: Integration | RpcIntegration, feature: IntegrationFeatures) -> bool:
    return feature in instance.get_provider().features
