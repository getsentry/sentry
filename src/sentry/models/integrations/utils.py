from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.integrations import (
        IntegrationFeatures,
        IntegrationInstallation,
        IntegrationProvider,
    )
    from sentry.models.integrations.integration import Integration
    from sentry.models.integrations.sentry_app import SentryApp
    from sentry.services.hybrid_cloud.integration.model import RpcIntegration


def get_provider(instance: Integration | RpcIntegration) -> IntegrationProvider:
    from sentry import integrations

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


def is_response_success(resp) -> bool:
    if resp.status_code:
        if resp.status_code < 300:
            return True
    return False


def is_response_error(resp) -> bool:
    if resp.status_code:
        if resp.status_code >= 400 and resp.status_code != 429 and resp.status_code < 500:
            return True
    return False


def get_redis_key(sentryapp: SentryApp, org_id):
    from sentry.models.integrations.sentry_app_installation import SentryAppInstallation

    installations = SentryAppInstallation.objects.filter(
        organization_id=org_id,
        sentry_app=sentryapp,
    )
    if installations.exists():
        installation = installations.first()
        return f"sentry-app-error:{installation.uuid}"
    return ""
