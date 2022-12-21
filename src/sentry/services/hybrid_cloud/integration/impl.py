from __future__ import annotations

from sentry.services.hybrid_cloud.integration import APIIntegration, IntegrationService


class DatabaseBackedIntegrationService(IntegrationService):
    def close(self) -> None:
        pass

    def get_by_provider_id(self, provider: str, external_id: str) -> APIIntegration | None:
        from sentry.models import Integration

        integration = Integration.objects.filter(provider=provider, external_id=external_id).first()

        if integration:
            return APIIntegration(
                id=integration.id,
                provider=integration.provider,
                external_id=integration.external_id,
                name=integration.name,
                status=integration.status,
                metadata=integration.metadata,
            )

        return None
