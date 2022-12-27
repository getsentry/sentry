from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Iterable, List

from sentry.services.hybrid_cloud.integration import (
    APIIntegration,
    APIOrganizationIntegration,
    IntegrationService,
)
from sentry.services.hybrid_cloud.user import APIUser
from sentry.signals import integration_added

if TYPE_CHECKING:
    from sentry.integrations.base import IntegrationFeatures
    from sentry.models.user import User

logger = logging.getLogger(__name__)


class DatabaseBackedIntegrationService(IntegrationService):
    def close(self) -> None:
        pass

    def get_many(
        self, *, integration_ids: Iterable[int] | None = None, organization_id: int | None = None
    ) -> List[APIIntegration]:
        from sentry.models.integrations import Integration

        queryset = None
        if integration_ids:
            queryset = Integration.objects.filter(id__in=integration_ids)  # type: ignore
        if organization_id is not None:
            queryset = (
                queryset.filter(organizations=organization_id)
                if queryset
                else Integration.objects.filter(organizations=organization_id)
            )
        return (
            [self._serialize_integration(integration) for integration in queryset]
            if queryset
            else []
        )

    def get_integration(
        self,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> APIIntegration | None:
        from sentry.models.integrations import Integration

        # If an integration_id is provided, use that -- otherwise, use the provider and external_id
        integration_kwargs = (
            {"id": integration_id}
            if integration_id
            else {"provider": provider, "external_id": external_id}
        )
        integration = Integration.objects.filter(**integration_kwargs).first()
        return self._serialize_integration(integration) if integration else None

    def get_organization_integrations(
        self, integration_id: int
    ) -> List[APIOrganizationIntegration]:
        from sentry.models.integrations import OrganizationIntegration

        ois = OrganizationIntegration.objects.filter(integration_id=integration_id)

        return [self._serialize_organization_integration(oi) for oi in ois]

    # Instance methods

    def get_installation(self, integration_id: int, organization_id: int, **kwargs):
        from sentry import integrations

        integration = self.get_integration(integration_id=integration_id)
        if not integration:
            return None
        provider = integrations.get(integration.provider)
        return provider.get_installation(integration, organization_id, **kwargs)

    def has_feature(self, provider: str, feature: IntegrationFeatures) -> bool | None:
        from sentry import integrations

        provider = integrations.get(provider)
        return feature in provider.features

    def add_organization(
        self,
        integration_id: int,
        organization_id: int,
        user: User | APIUser | None = None,
        default_auth_id=None,
    ):
        """
        Add an organization to this integration.

        Returns False if the OrganizationIntegration was not created
        """
        from django.db import IntegrityError

        from sentry.models.integrations import OrganizationIntegration

        integration = self.get_integration(integration_id=integration_id)
        if not integration:
            logger.info(
                "add-organization-invalid-integration",
                extra={
                    "organization_id": organization_id,
                    "provided_integration_id": integration_id,
                },
            )
            return False

        try:
            org_integration, created = OrganizationIntegration.objects.get_or_create(
                organization_id=organization_id,
                integration_id=integration.id,
                defaults={"default_auth_id": default_auth_id, "config": {}},
            )
            # TODO(Steve): add audit log if created
            if not created and default_auth_id:
                org_integration.update(default_auth_id=default_auth_id)
        except IntegrityError:
            logger.info(
                "add-organization-integrity-error",
                extra={
                    "organization_id": organization_id,
                    "integration_id": integration.id,
                    "default_auth_id": default_auth_id,
                },
            )
            return False
        else:
            integration_added.send_robust(
                integration=integration,
                organization_id=organization_id,
                user=user,
                sender=integration.__class__,
            )

            return org_integration
